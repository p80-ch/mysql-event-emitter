/* jshint node:true */
/* jshint esversion: 6 */
/* jshint strict:false */
"use strict";


const MyBinlogEmitter = require('mysql-binlog-emitter');
const MyBinlogEvent = MyBinlogEmitter.Events;
const BinlogEvent = MyBinlogEmitter.BinlogEvents;

const EventEmitter = require('events');


class MyEmitter extends EventEmitter {

  /**
   * @param Object conf
   * @param Object conf.mysql                       - mysql pool connection options; 
   * @param Object [conf.binlog=null]           
   * @param Object [conf.binlog.slaveId=1]          - When using multiple clients against the same mysql server this ID must be counted up
   * @param Object [conf.binlog.recoverTimeout=240] - Time in ms between reconnection attempts
   */
  constructor(conf) {
    super();


    this._mbe = new MyBinlogEmitter(conf);

    this._mbe.on(MyBinlogEvent.CONNECTED, this.emit.bind(this, 'connected'));
    this._mbe.on(MyBinlogEvent.DISCONNECTED, this.emit.bind(this, 'disconnected'));
    this._mbe.on(MyBinlogEvent.RECONNECTING, this.emit.bind(this, 'reconnecting'));
    this._mbe.on(MyBinlogEvent.RECOVERING, this.emit.bind(this, 'recovering'));

    this._mbe.on(MyBinlogEvent.ERROR, this.emit.bind(this, 'error'));


    this._mbe.on(BinlogEvent.TABLE_MAP_EVENT, this._table_map.bind(this));

    this._mbe.on(BinlogEvent.WRITE_ROWS_EVENTv0, this._rows.bind(this));
    this._mbe.on(BinlogEvent.WRITE_ROWS_EVENTv1, this._rows.bind(this));
    this._mbe.on(BinlogEvent.WRITE_ROWS_EVENTv2, this._rows.bind(this));

    this._mbe.on(BinlogEvent.UPDATE_ROWS_EVENTv0, this._rows.bind(this));
    this._mbe.on(BinlogEvent.UPDATE_ROWS_EVENTv1, this._rows.bind(this));
    this._mbe.on(BinlogEvent.UPDATE_ROWS_EVENTv2, this._rows.bind(this));

    this._mbe.on(BinlogEvent.DELETE_ROWS_EVENTv0, this._rows.bind(this));
    this._mbe.on(BinlogEvent.DELETE_ROWS_EVENTv1, this._rows.bind(this));
    this._mbe.on(BinlogEvent.DELETE_ROWS_EVENTv2, this._rows.bind(this));

    this._mbe.on(BinlogEvent.QUERY_EVENT, this._query.bind(this));


    var events = [
      'connected',
      'disconnected',
      'reconnecting',
      'recovering',

      'error',

      'change',
      'insert',
      'update',
      'delete',
      'truncate',
    ];

    this._hasVanillaEvents = false;
    this.on('newListener', function(event, listener) {
      if (events.indexOf(event) == -1) {
        this._hasVanillaEvents = true;
      }
    }.bind(this));


    // table map
    this._tm = {};
  }

  _table_map(packet) {

    if (!packet.data) {
      this.emit('error', new Error('No packet data'), packet);
      return;
    } else if (!packet.data.tableId) {
      this.emit('error', new Error('No packet table id'), packet);
      return;
    }

    this._tm['x' + packet.data.tableId] = {
      schema: packet.data.schemaName,
      table: packet.data.tableName,
    };

  }

  _rows(packet) {

    if (!packet.data) {
      this.emit('error', new Error('No packet data'), packet);
      return;
    } else if (!packet.data.tableId) {
      this.emit('error', new Error('No packet table id'), packet);
      return;
    } else if (!this._tm['x' + packet.data.tableId]) {
      this.emit('error', new Error('No table id'));
      return;
    }

    var tm = this._tm['x' + packet.data.tableId];

    switch (packet.eventType) {

      case BinlogEvent.WRITE_ROWS_EVENTv0:
      case BinlogEvent.WRITE_ROWS_EVENTv1:
      case BinlogEvent.WRITE_ROWS_EVENTv2:
        this.emit('insert', tm.schema, tm.table);
        this.emit('change', tm.schema, tm.table, 'insert');
        this._vanilla(tm.schema, tm.table, 'insert');
        break;

      case BinlogEvent.UPDATE_ROWS_EVENTv0:
      case BinlogEvent.UPDATE_ROWS_EVENTv1:
      case BinlogEvent.UPDATE_ROWS_EVENTv2:
        this.emit('update', tm.schema, tm.table);
        this.emit('change', tm.schema, tm.table, 'update');
        this._vanilla(tm.schema, tm.table, 'update');
        break;

      case BinlogEvent.DELETE_ROWS_EVENTv0:
      case BinlogEvent.DELETE_ROWS_EVENTv1:
      case BinlogEvent.DELETE_ROWS_EVENTv2:
        this.emit('delete', tm.schema, tm.table);
        this.emit('change', tm.schema, tm.table, 'delete');
        this._vanilla(tm.schema, tm.table, 'delete');
        break;

      default:
        this.emit('error', new Error('Event type not found'));
    }
  }

  _query(packet) {
    
    if (!packet.data) {
      this.emit('error', new Error('No packet data'), packet);
      return;
    } else if (!packet.data.query) {
      this.emit('error', new Error('No query'), packet);
      return;
    }

    if (packet.data.query.substr(0, 8) == 'TRUNCATE') {
      var q = packet.data.query;

      q = q.substr(9); // remove TRUNCATE 

      if (q.substr(0, 5) == 'TABLE') {
        q = q.substr(6); // remove TABLE
      }

      q = q.replace(/;/g, ''); // remove special chars
      q = q.replace(/`/g, '');
      q = q.trim();

      this.emit('truncate', packet.data.schema, q);
      this.emit('change', packet.data.schema, q, 'truncate');
      this._vanilla(packet.data.schema, q, 'truncate');
    }
  }

  _vanilla(schema, table, event) {
    if (this._hasVanillaEvents) {
      this.emit(schema, table, event);
      this.emit(table, event);
      this.emit(schema + '.' + table, event);
      this.emit(table + '.' + event);
      this.emit(schema + '.' + table + '.' + event);
    }
  }


  /**
   * @param Function [cb]
   */
  start(cb) {
    this._mbe.start(cb);
  }


  /**
   * @param Function [cb]
   */
  stop(cb) {
    this._mbe.stop(cb);
  }


  /**
   * @param Function [cb]
   */
  restart(cb) {
    this._mbe.restart(cb);
  }


}

module.exports = MyEmitter;
