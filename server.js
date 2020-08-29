'use strict';

const SERVER_SETTINGS = {
  port: 8080,
  maxBackpressure: 8192,
  build: 0,
  gamemode: 'FFA',
  minObjectSize: 10,
  gridSize: 25
};

const FFA_SETTINGS = {
  arenaW: 2e3,
  arenaH: 2e3,
  tickTime: 40
  /* WebSocket close codes
  4000: 'Invalid build'
  */
  /* XHR close codes
  429: 'Already in game' (too many requests)
  */
  /* WebSocket packets
  
  server -> client:
  0: upcreate
  1: first message means verification successful, consequent mean pong
  2: delete
  3: maybe server message
  4: maybe server info
  5: maybe this count
  6:

  client -> server:
  first packet has no op, it is just the build casted into 7-base-bit varuint
  0: info
  1: ping
  2: upgrade stats
  3: upgrade tank
  4: spawn
  5:
  6:

  */
};

const DATA = {
  /* colors
  0: blue
  1: yellow (square)
  */
  /* type
  0: circle              [0, r]
  1: triangle            [1, w, h]
  2: rectangle           [2, w, h]
  3: pentagon            [3, w];
  4: trapezoid           [4, base length, arm angle, arm length]
  */
  shapes: {
    CID: 0,
    PID: 0,
    square: {
      r: 40,
      color: 1
    }
  },
  player: {
    CID: 1,
    PID: 1
  },
  tanks: {
    basic: {
      r: 30,
      color: 0
    }
  }
};

class Iterator extends Array {
  constructor(maxSize = 0, delSize = 0) {
    super(maxSize);
    this.Count = 0;
    this.Pos = new Array(maxSize);
    this.FreePos = new Array(delSize);
    this.FreePosLength = 0;
  }
  add(object) {
    if(this.FreePosLength != 0) {
      this[this.Count] = [object, this.FreePos[--this.FreePosLength]];
      this.Pos[this.FreePos[this.FreePosLength]] = this.Count++;
      return this.FreePos[this.FreePosLength];
    } else {
      this[this.Count] = [object, this.Count];
      this.Pos[this.Count] = this.Count;
      return this.Count++;
    }
  }
  delete(id) {
    this.FreePos[this.FreePosLength++] = id;
    this[this.Pos[id]] = this[--this.Count];
    this.Pos[this[this.Count][1]] = this.Pos[id];
  }
}

function DynamicCollision(d1, d2, d) {
  switch(d1.CID) {
    case 0: {
      switch(d2.CID) {
        case 0: {
          const angle = Math.atan2(d1.y - d2.y, d1.x - d2.x);
          d1.vx = Math.cos(angle) * 3;
          d1.vy = Math.sin(angle) * 3;
          d2.vx = -Math.cos(angle) * 3;
          d2.vy = -Math.sin(angle) * 3;
          break;
        }
        default: break;
      }
      break;
    }
    default: break;
  }
}
function StaticCollision(d, s) {
  // detect
}

function QuadTree(SETTINGS) {
  function QT(x, y, w, h, parent) {
    [this.x, this.y, this.w, this.h, this.parent] = [x, y, w, h, parent];
    this.Dynamic = new Array(4);
    this.DynamicCount = 0;
    this.Static = new Array(4);
    this.StaticCount = 0;
    this.nodes = new Array(4);
    this.divided = false;
    this.checkForMerge = false;
  };
  QT.prototype.getObjects = function(object, copies = {}) {
    if(this.divided == false) {
      for(var i = 0; i < this.DynamicCount; i++) {
        if(copies[this.Dynamic[i]] == null) {
          copies[this.Dynamic[i]] = 0;
          object[0][object[1]++] = this.Dynamic[i];
        }
      }
      for(i = 0; i < this.StaticCount; i++) {
        if(copies[this.Static[i]] == null) {
          copies[this.Static[i]] = 0;
          object[2][object[3]++] = this.Static[i];
        }
      }
    } else {
      this.nodes[0].getObjects(object, copies);
      this.nodes[1].getObjects(object, copies);
      this.nodes[2].getObjects(object, copies);
      this.nodes[3].getObjects(object, copies);
    }
  };
  QT.prototype.query = function(x, y, w, h, object, copies = {}) {
    if(this.divided == false) {
      for(var i = 0; i < this.DynamicCount; i++) {
        if(copies[this.Dynamic[i]] == null && (
         o[o.Pos[this.Dynamic[i]]][0].x + o[o.Pos[this.Dynamic[i]]][0].r <= x     ||
         o[o.Pos[this.Dynamic[i]]][0].x - o[o.Pos[this.Dynamic[i]]][0].r >= x + w ||
         o[o.Pos[this.Dynamic[i]]][0].y + o[o.Pos[this.Dynamic[i]]][0].r <= y     ||
         o[o.Pos[this.Dynamic[i]]][0].y - o[o.Pos[this.Dynamic[i]]][0].r >= y + h) == false) {
          copies[this.Dynamic[i]] = 0;
          object[0][object[1]++] = this.Dynamic[i];
        }
      }
      for(i = 0; i < this.StaticCount; i++) {
        if(copies[this.Static[i]] == null && (
         o[o.Pos[this.Static[i]]][0].x + o[o.Pos[this.Static[i]]][0].w / 2 <= x     ||
         o[o.Pos[this.Static[i]]][0].x - o[o.Pos[this.Static[i]]][0].w / 2 >= x + w ||
         o[o.Pos[this.Static[i]]][0].y + o[o.Pos[this.Static[i]]][0].h / 2 <= y     ||
         o[o.Pos[this.Static[i]]][0].y - o[o.Pos[this.Static[i]]][0].h / 2 >= y + h) == false) {
          copies[this.Static[i]] = 0;
          object[2][object[3]++] = this.Static[i];
        }
      }
    } else {
      if((this.nodes[0].x + this.nodes[0].w <= x || this.nodes[0].x >= x + w || this.nodes[0].y + this.nodes[0].h <= y || this.nodes[0].y >= y + h) == false) {
        this.nodes[0].query(x, y, w, h, object, copies);
      }
      if((this.nodes[1].x + this.nodes[1].w <= x || this.nodes[1].x >= x + w || this.nodes[1].y + this.nodes[1].h <= y || this.nodes[1].y >= y + h) == false) {
        this.nodes[1].query(x, y, w, h, object, copies);
      }
      if((this.nodes[2].x + this.nodes[2].w <= x || this.nodes[2].x >= x + w || this.nodes[2].y + this.nodes[2].h <= y || this.nodes[2].y >= y + h) == false) {
        this.nodes[2].query(x, y, w, h, object, copies);
      }
      if((this.nodes[3].x + this.nodes[3].w <= x || this.nodes[3].x >= x + w || this.nodes[3].y + this.nodes[3].h <= y || this.nodes[3].y >= y + h) == false) {
        this.nodes[3].query(x, y, w, h, object, copies);
      }
    }
  };
  QT.prototype.queryAll = function(x, y, w, h, object, copies = {}) {
    if(this.divided == false) {
      for(var i = 0; i < this.DynamicCount; i++) {
        if(copies[this.Dynamic[i]] == null && (
         o[o.Pos[this.Dynamic[i]]][0].x + o[o.Pos[this.Dynamic[i]]][0].r <= x     ||
         o[o.Pos[this.Dynamic[i]]][0].x - o[o.Pos[this.Dynamic[i]]][0].r >= x + w ||
         o[o.Pos[this.Dynamic[i]]][0].y + o[o.Pos[this.Dynamic[i]]][0].r <= y     ||
         o[o.Pos[this.Dynamic[i]]][0].y - o[o.Pos[this.Dynamic[i]]][0].r >= y + h) == false) {
          copies[this.Dynamic[i]] = 0;
          object[0][object[1]++] = this.Dynamic[i];
        }
      }
      for(i = 0; i < this.StaticCount; i++) {
        if(copies[this.Static[i]] == null && (
         o[o.Pos[this.Static[i]]][0].x + o[o.Pos[this.Static[i]]][0].w / 2 <= x     ||
         o[o.Pos[this.Static[i]]][0].x - o[o.Pos[this.Static[i]]][0].w / 2 >= x + w ||
         o[o.Pos[this.Static[i]]][0].y + o[o.Pos[this.Static[i]]][0].h / 2 <= y     ||
         o[o.Pos[this.Static[i]]][0].y - o[o.Pos[this.Static[i]]][0].h / 2 >= y + h) == false) {
          copies[this.Static[i]] = 0;
          object[0][object[1]++] = this.Static[i];
        }
      }
    } else {
      if((this.nodes[0].x + this.nodes[0].w <= x || this.nodes[0].x >= x + w || this.nodes[0].y + this.nodes[0].h <= y || this.nodes[0].y >= y + h) == false) {
        this.nodes[0].queryAll(x, y, w, h, object, copies);
      }
      if((this.nodes[1].x + this.nodes[1].w <= x || this.nodes[1].x >= x + w || this.nodes[1].y + this.nodes[1].h <= y || this.nodes[1].y >= y + h) == false) {
        this.nodes[1].queryAll(x, y, w, h, object, copies);
      }
      if((this.nodes[2].x + this.nodes[2].w <= x || this.nodes[2].x >= x + w || this.nodes[2].y + this.nodes[2].h <= y || this.nodes[2].y >= y + h) == false) {
        this.nodes[2].queryAll(x, y, w, h, object, copies);
      }
      if((this.nodes[3].x + this.nodes[3].w <= x || this.nodes[3].x >= x + w || this.nodes[3].y + this.nodes[3].h <= y || this.nodes[3].y >= y + h) == false) {
        this.nodes[3].queryAll(x, y, w, h, object, copies);
      }
    }
  };
  QT.prototype.firstInsertDynamic = function(objID) {
    if(this.divided == false) {
      if((this.DynamicCount + this.DynamicCount * (this.DynamicCount - 1) / 2) * (this.StaticCount + 1) > 10 && SERVER_SETTINGS.minObjectSize < this.w / 2) {
        this.nodes[0] = new QT(this.x, this.y, this.w / 2, this.h / 2, this);
        this.nodes[0].Dynamic[this.nodes[0].DynamicCount++] = objID;

        this.nodes[1] = new QT(this.x, this.y + this.h / 2, this.w / 2, this.h / 2, this);
        this.nodes[1].Dynamic[this.nodes[1].DynamicCount++] = objID;

        this.nodes[2] = new QT(this.x + this.w / 2, this.y, this.w / 2, this.h / 2, this);
        this.nodes[2].Dynamic[this.nodes[2].DynamicCount++] = objID;

        this.nodes[3] = new QT(this.x + this.w / 2, this.y + this.h / 2, this.w / 2, this.h / 2, this);
        this.nodes[3].Dynamic[this.nodes[3].DynamicCount++] = objID;

        for(var i = 0; i < this.DynamicCount; i++) {
          this.nodes[0].Dynamic[this.nodes[0].DynamicCount++] = this.Dynamic[i];
          this.nodes[1].Dynamic[this.nodes[1].DynamicCount++] = this.Dynamic[i];
          this.nodes[2].Dynamic[this.nodes[2].DynamicCount++] = this.Dynamic[i];
          this.nodes[3].Dynamic[this.nodes[3].DynamicCount++] = this.Dynamic[i];
        }

        for(i = 0; i < this.StaticCount; i++) {
          this.nodes[0].Static[this.nodes[0].StaticCount++] = this.Static[i];
          this.nodes[1].Static[this.nodes[1].StaticCount++] = this.Static[i];
          this.nodes[2].Static[this.nodes[2].StaticCount++] = this.Static[i];
          this.nodes[3].Static[this.nodes[3].StaticCount++] = this.Static[i];
        }
        this.divided = 1;
      } else {
        this.Dynamic[this.DynamicCount++] = objID;
      }
    } else {
      if((
       (o[o.Pos[objID]][0].x + o[o.Pos[objID]][0].r <= this.nodes[0].x                   && this.nodes[0].x                   != e.x      ) ||
       (o[o.Pos[objID]][0].x - o[o.Pos[objID]][0].r >= this.nodes[0].x + this.nodes[0].w && this.nodes[0].x + this.nodes[0].w != e.x + e.w) ||
       (o[o.Pos[objID]][0].y + o[o.Pos[objID]][0].r <= this.nodes[0].y                   && this.nodes[0].y                   != e.y      ) ||
       (o[o.Pos[objID]][0].y - o[o.Pos[objID]][0].r >= this.nodes[0].y + this.nodes[0].h && this.nodes[0].y + this.nodes[0].h != e.y + e.h)) == false) {
        this.nodes[0].firstInsertDynamic(objID);
      }
      if((
       (o[o.Pos[objID]][0].x + o[o.Pos[objID]][0].r <= this.nodes[1].x                   && this.nodes[1].x                   != e.x      ) ||
       (o[o.Pos[objID]][0].x - o[o.Pos[objID]][0].r >= this.nodes[1].x + this.nodes[1].w && this.nodes[1].x + this.nodes[1].w != e.x + e.w) ||
       (o[o.Pos[objID]][0].y + o[o.Pos[objID]][0].r <= this.nodes[1].y                   && this.nodes[1].y                   != e.y      ) ||
       (o[o.Pos[objID]][0].y - o[o.Pos[objID]][0].r >= this.nodes[1].y + this.nodes[1].h && this.nodes[1].y + this.nodes[1].h != e.y + e.h)) == false) {
        this.nodes[1].firstInsertDynamic(objID);
      }
      if((
       (o[o.Pos[objID]][0].x + o[o.Pos[objID]][0].r <= this.nodes[2].x                   && this.nodes[2].x                   != e.x      ) ||
       (o[o.Pos[objID]][0].x - o[o.Pos[objID]][0].r >= this.nodes[2].x + this.nodes[2].w && this.nodes[2].x + this.nodes[2].w != e.x + e.w) ||
       (o[o.Pos[objID]][0].y + o[o.Pos[objID]][0].r <= this.nodes[2].y                   && this.nodes[2].y                   != e.y      ) ||
       (o[o.Pos[objID]][0].y - o[o.Pos[objID]][0].r >= this.nodes[2].y + this.nodes[2].h && this.nodes[2].y + this.nodes[2].h != e.y + e.h)) == false) {
        this.nodes[2].firstInsertDynamic(objID);
      }
      if((
       (o[o.Pos[objID]][0].x + o[o.Pos[objID]][0].r <= this.nodes[3].x                   && this.nodes[3].x                   != e.x      ) ||
       (o[o.Pos[objID]][0].x - o[o.Pos[objID]][0].r >= this.nodes[3].x + this.nodes[3].w && this.nodes[3].x + this.nodes[3].w != e.x + e.w) ||
       (o[o.Pos[objID]][0].y + o[o.Pos[objID]][0].r <= this.nodes[3].y                   && this.nodes[3].y                   != e.y      ) ||
       (o[o.Pos[objID]][0].y - o[o.Pos[objID]][0].r >= this.nodes[3].y + this.nodes[3].h && this.nodes[3].y + this.nodes[3].h != e.y + e.h)) == false) {
        this.nodes[3].firstInsertDynamic(objID);
      }
    }
  };
  QT.prototype.firstInsertStatic = function(objID) {
    if(this.divided == false) {
      if((this.DynamicCount + this.DynamicCount * (this.DynamicCount - 1) / 2) * (this.StaticCount + 1) > 10 && SERVER_SETTINGS.minObjectSize < this.w / 2) {
        this.nodes[0] = new QT(this.x, this.y, this.w / 2, this.h / 2, this);
        this.nodes[0].Static[this.nodes[0].StaticCount++] = objID;

        this.nodes[1] = new QT(this.x, this.y + this.h / 2, this.w / 2, this.h / 2, this);
        this.nodes[1].Static[this.nodes[1].StaticCount++] = objID;

        this.nodes[2] = new QT(this.x + this.w / 2, this.y, this.w / 2, this.h / 2, this);
        this.nodes[2].Static[this.nodes[2].StaticCount++] = objID;

        this.nodes[3] = new QT(this.x + this.w / 2, this.y + this.h / 2, this.w / 2, this.h / 2, this);
        this.nodes[3].Static[this.nodes[3].StaticCount++] = objID;

        for(var i = 0; i < this.StaticCount; i++) {
          this.nodes[0].Static[this.nodes[0].StaticCount++] = this.Static[i];
          this.nodes[1].Static[this.nodes[1].StaticCount++] = this.Static[i];
          this.nodes[2].Static[this.nodes[2].StaticCount++] = this.Static[i];
          this.nodes[3].Static[this.nodes[3].StaticCount++] = this.Static[i];
        }

        for(i = 0; i < this.DynamicCount; i++) {
          this.nodes[0].Dynamic[this.nodes[0].DynamicCount++] = this.Dynamic[i];
          this.nodes[1].Dynamic[this.nodes[1].DynamicCount++] = this.Dynamic[i];
          this.nodes[2].Dynamic[this.nodes[2].DynamicCount++] = this.Dynamic[i];
          this.nodes[3].Dynamic[this.nodes[3].DynamicCount++] = this.Dynamic[i];
        }
        this.divided = 1;
      } else {
        this.Static[this.StaticCount++] = objID;
      }
    } else {
      if((
       (o[o.Pos[objID]][0].x + o[o.Pos[objID]][0].w / 2 <= this.nodes[0].x                   && this.nodes[0].x                   != e.x      ) ||
       (o[o.Pos[objID]][0].x - o[o.Pos[objID]][0].w / 2 >= this.nodes[0].x + this.nodes[0].w && this.nodes[0].x + this.nodes[0].w != e.x + e.w) ||
       (o[o.Pos[objID]][0].y + o[o.Pos[objID]][0].h / 2 <= this.nodes[0].y                   && this.nodes[0].y                   != e.y      ) ||
       (o[o.Pos[objID]][0].y - o[o.Pos[objID]][0].h / 2 >= this.nodes[0].y + this.nodes[0].h && this.nodes[0].y + this.nodes[0].h != e.y + e.h)) == false) {
        this.nodes[0].firstInsertStatic(objID);
      }
      if((
       (o[o.Pos[objID]][0].x + o[o.Pos[objID]][0].w / 2 <= this.nodes[1].x                   && this.nodes[1].x                   != e.x      ) ||
       (o[o.Pos[objID]][0].x - o[o.Pos[objID]][0].w / 2 >= this.nodes[1].x + this.nodes[1].w && this.nodes[1].x + this.nodes[1].w != e.x + e.w) ||
       (o[o.Pos[objID]][0].y + o[o.Pos[objID]][0].h / 2 <= this.nodes[1].y                   && this.nodes[1].y                   != e.y      ) ||
       (o[o.Pos[objID]][0].y - o[o.Pos[objID]][0].h / 2 >= this.nodes[1].y + this.nodes[1].h && this.nodes[1].y + this.nodes[1].h != e.y + e.h)) == false) {
        this.nodes[1].firstInsertStatic(objID);
      }
      if((
       (o[o.Pos[objID]][0].x + o[o.Pos[objID]][0].w / 2 <= this.nodes[2].x                   && this.nodes[2].x                   != e.x      ) ||
       (o[o.Pos[objID]][0].x - o[o.Pos[objID]][0].w / 2 >= this.nodes[2].x + this.nodes[2].w && this.nodes[2].x + this.nodes[2].w != e.x + e.w) ||
       (o[o.Pos[objID]][0].y + o[o.Pos[objID]][0].h / 2 <= this.nodes[2].y                   && this.nodes[2].y                   != e.y      ) ||
       (o[o.Pos[objID]][0].y - o[o.Pos[objID]][0].h / 2 >= this.nodes[2].y + this.nodes[2].h && this.nodes[2].y + this.nodes[2].h != e.y + e.h)) == false) {
        this.nodes[2].firstInsertStatic(objID);
      }
      if((
       (o[o.Pos[objID]][0].x + o[o.Pos[objID]][0].w / 2 <= this.nodes[3].x                   && this.nodes[3].x                   != e.x      ) ||
       (o[o.Pos[objID]][0].x - o[o.Pos[objID]][0].w / 2 >= this.nodes[3].x + this.nodes[3].w && this.nodes[3].x + this.nodes[3].w != e.x + e.w) ||
       (o[o.Pos[objID]][0].y + o[o.Pos[objID]][0].h / 2 <= this.nodes[3].y                   && this.nodes[3].y                   != e.y      ) ||
       (o[o.Pos[objID]][0].y - o[o.Pos[objID]][0].h / 2 >= this.nodes[3].y + this.nodes[3].h && this.nodes[3].y + this.nodes[3].h != e.y + e.h)) == false) {
        this.nodes[3].firstInsertStatic(objID);
      }
    }
  };
  QT.prototype.insertDynamic = function(objID) {
    if(this.divided == false) {
      for(var i = 0; i < this.DynamicCount; i++) {
        if(this.Dynamic[i] == objID) {
          return;
        }
      }
      if((this.DynamicCount + this.DynamicCount * (this.DynamicCount - 1) / 2) * (this.StaticCount + 1) > 10 && SERVER_SETTINGS.minObjectSize < this.w / 2) {
        this.nodes[0] = new QT(this.x, this.y, this.w / 2, this.h / 2, e, this);
        this.nodes[0].Dynamic[this.nodes[0].DynamicCount++] = objID;

        this.nodes[1] = new QT(this.x, this.y + this.h / 2, this.w / 2, this.h / 2, e, this);
        this.nodes[1].Dynamic[this.nodes[1].DynamicCount++] = objID;

        this.nodes[2] = new QT(this.x + this.w / 2, this.y, this.w / 2, this.h / 2, e, this);
        this.nodes[2].Dynamic[this.nodes[2].DynamicCount++] = objID;

        this.nodes[3] = new QT(this.x + this.w / 2, this.y + this.h / 2, this.w / 2, this.h / 2, e, this);
        this.nodes[3].Dynamic[this.nodes[3].DynamicCount++] = objID;

        for(i = 0; i < this.DynamicCount; i++) {
          this.nodes[0].Dynamic[this.nodes[0].DynamicCount++] = this.Dynamic[i];
          this.nodes[1].Dynamic[this.nodes[1].DynamicCount++] = this.Dynamic[i];
          this.nodes[2].Dynamic[this.nodes[2].DynamicCount++] = this.Dynamic[i];
          this.nodes[3].Dynamic[this.nodes[3].DynamicCount++] = this.Dynamic[i];
        }

        for(i = 0; i < this.StaticCount; i++) {
          this.nodes[0].Static[this.nodes[0].StaticCount++] = this.Static[i];
          this.nodes[1].Static[this.nodes[1].StaticCount++] = this.Static[i];
          this.nodes[2].Static[this.nodes[2].StaticCount++] = this.Static[i];
          this.nodes[3].Static[this.nodes[3].StaticCount++] = this.Static[i];
        }
        this.divided = 1;
      } else {
        this.Dynamic[this.DynamicCount++] = objID;
      }
    } else {
      if((
       (o[o.Pos[objID]][0].x + o[o.Pos[objID]][0].r <= this.nodes[0].x                   && this.nodes[0].x                   != e.x      ) ||
       (o[o.Pos[objID]][0].x - o[o.Pos[objID]][0].r >= this.nodes[0].x + this.nodes[0].w && this.nodes[0].x + this.nodes[0].w != e.x + e.w) ||
       (o[o.Pos[objID]][0].y + o[o.Pos[objID]][0].r <= this.nodes[0].y                   && this.nodes[0].y                   != e.y      ) ||
       (o[o.Pos[objID]][0].y - o[o.Pos[objID]][0].r >= this.nodes[0].y + this.nodes[0].h && this.nodes[0].y + this.nodes[0].h != e.y + e.h)) == false) {
        this.nodes[0].insertDynamic(objID);
      }
      if((
       (o[o.Pos[objID]][0].x + o[o.Pos[objID]][0].r <= this.nodes[1].x                   && this.nodes[1].x                   != e.x      ) ||
       (o[o.Pos[objID]][0].x - o[o.Pos[objID]][0].r >= this.nodes[1].x + this.nodes[1].w && this.nodes[1].x + this.nodes[1].w != e.x + e.w) ||
       (o[o.Pos[objID]][0].y + o[o.Pos[objID]][0].r <= this.nodes[1].y                   && this.nodes[1].y                   != e.y      ) ||
       (o[o.Pos[objID]][0].y - o[o.Pos[objID]][0].r >= this.nodes[1].y + this.nodes[1].h && this.nodes[1].y + this.nodes[1].h != e.y + e.h)) == false) {
        this.nodes[1].insertDynamic(objID);
      }
      if((
       (o[o.Pos[objID]][0].x + o[o.Pos[objID]][0].r <= this.nodes[2].x                   && this.nodes[2].x                   != e.x      ) ||
       (o[o.Pos[objID]][0].x - o[o.Pos[objID]][0].r >= this.nodes[2].x + this.nodes[2].w && this.nodes[2].x + this.nodes[2].w != e.x + e.w) ||
       (o[o.Pos[objID]][0].y + o[o.Pos[objID]][0].r <= this.nodes[2].y                   && this.nodes[2].y                   != e.y      ) ||
       (o[o.Pos[objID]][0].y - o[o.Pos[objID]][0].r >= this.nodes[2].y + this.nodes[2].h && this.nodes[2].y + this.nodes[2].h != e.y + e.h)) == false) {
        this.nodes[2].insertDynamic(objID);
      }
      if((
       (o[o.Pos[objID]][0].x + o[o.Pos[objID]][0].r <= this.nodes[3].x                   && this.nodes[3].x                   != e.x      ) ||
       (o[o.Pos[objID]][0].x - o[o.Pos[objID]][0].r >= this.nodes[3].x + this.nodes[3].w && this.nodes[3].x + this.nodes[3].w != e.x + e.w) ||
       (o[o.Pos[objID]][0].y + o[o.Pos[objID]][0].r <= this.nodes[3].y                   && this.nodes[3].y                   != e.y      ) ||
       (o[o.Pos[objID]][0].y - o[o.Pos[objID]][0].r >= this.nodes[3].y + this.nodes[3].h && this.nodes[3].y + this.nodes[3].h != e.y + e.h)) == false) {
        this.nodes[3].insertDynamic(objID);
      }
    }
  };
  QT.prototype.deleteDynamic = function(objID) {
    if(this.divided == false) {
      for(var i = 0; i < this.DynamicCount; i++) {
        if(this.Dynamic[i] == objID) {
          this.Dynamic[i] = this.Dynamic[--this.DynamicCount];
          return;
        }
      }
    } else {
      if((
       o[o.Pos[objID]][0].x + o[o.Pos[objID]][0].r <= this.nodes[0].x                   ||
       o[o.Pos[objID]][0].x - o[o.Pos[objID]][0].r >= this.nodes[0].x + this.nodes[0].w ||
       o[o.Pos[objID]][0].y + o[o.Pos[objID]][0].r <= this.nodes[0].y                   ||
       o[o.Pos[objID]][0].y - o[o.Pos[objID]][0].r >= this.nodes[0].y + this.nodes[0].h) == false) {
        this.nodes[0].deleteDynamic(objID);
      }
      if((
       o[o.Pos[objID]][0].x + o[o.Pos[objID]][0].r <= this.nodes[1].x                   ||
       o[o.Pos[objID]][0].x - o[o.Pos[objID]][0].r >= this.nodes[1].x + this.nodes[1].w ||
       o[o.Pos[objID]][0].y + o[o.Pos[objID]][0].r <= this.nodes[1].y                   ||
       o[o.Pos[objID]][0].y - o[o.Pos[objID]][0].r >= this.nodes[1].y + this.nodes[1].h) == false) {
        this.nodes[1].deleteDynamic(objID);
      }
      if((
       o[o.Pos[objID]][0].x + o[o.Pos[objID]][0].r <= this.nodes[2].x                   ||
       o[o.Pos[objID]][0].x - o[o.Pos[objID]][0].r >= this.nodes[2].x + this.nodes[2].w ||
       o[o.Pos[objID]][0].y + o[o.Pos[objID]][0].r <= this.nodes[2].y                   ||
       o[o.Pos[objID]][0].y - o[o.Pos[objID]][0].r >= this.nodes[2].y + this.nodes[2].h) == false) {
        this.nodes[2].deleteDynamic(objID);
      }
      if((
       o[o.Pos[objID]][0].x + o[o.Pos[objID]][0].r <= this.nodes[3].x                   ||
       o[o.Pos[objID]][0].x - o[o.Pos[objID]][0].r >= this.nodes[3].x + this.nodes[3].w ||
       o[o.Pos[objID]][0].y + o[o.Pos[objID]][0].r <= this.nodes[3].y                   ||
       o[o.Pos[objID]][0].y - o[o.Pos[objID]][0].r >= this.nodes[3].y + this.nodes[3].h) == false) {
        this.nodes[3].deleteDynamic(objID);
      }
      if(this.checkForMerge == true) {
        this.checkForMerge = false;
        const object = [[], 0, [], 0];
        this.getObjects(object);
        if((object[1] + object[1] * (object[1] - 1) / 2) * (object[3] + 1) <= 10) {
          this.divided = false;
          this.DynamicCount = 0;
          for(var i = 0; i < object[1]; i++) {
            this.Dynamic[this.DynamicCount++] = object[0][i];
          }
          this.StaticCount = 0;
          for(i = 0; i < object[3]; i++) {
            this.Static[this.StaticCount++] = object[0][i];
          }
          if(this.parent != null) {
            this.parent.checkForMerge = 1;
          }
        }
      }
    }
  };
  QT.prototype.deleteStatic = function(objID) {
    if(this.divided == false) {
      for(var i = 0; i < this.StaticCount; i++) {
        if(this.Static[i] == objID) {
          this.Static[i] = this.Static[--this.StaticCount];
          return;
        }
      }
    } else {
      if((
       o[o.Pos[objID]][0].x + o[o.Pos[objID]][0].w / 2 <= this.nodes[0].x                    ||
       o[o.Pos[objID]][0].x - o[o.Pos[objID]][0].w / 2 >= this.nodes[0].x + this.nodes[0].w  ||
       o[o.Pos[objID]][0].y + o[o.Pos[objID]][0].h / 2 <= this.nodes[0].y                    ||
       o[o.Pos[objID]][0].y - o[o.Pos[objID]][0].h / 2 >= this.nodes[0].y + this.nodes[0].h) == false) {
        this.nodes[0].deleteStatic(objID);
      }
      if((
       o[o.Pos[objID]][0].x + o[o.Pos[objID]][0].w / 2 <= this.nodes[1].x                    ||
       o[o.Pos[objID]][0].x - o[o.Pos[objID]][0].w / 2 >= this.nodes[1].x + this.nodes[1].w  ||
       o[o.Pos[objID]][0].y + o[o.Pos[objID]][0].h / 2 <= this.nodes[1].y                    ||
       o[o.Pos[objID]][0].y - o[o.Pos[objID]][0].h / 2 >= this.nodes[1].y + this.nodes[1].h) == false) {
        this.nodes[1].deleteStatic(objID);
      }
      if((
       o[o.Pos[objID]][0].x + o[o.Pos[objID]][0].w / 2 <= this.nodes[2].x                    ||
       o[o.Pos[objID]][0].x - o[o.Pos[objID]][0].w / 2 >= this.nodes[2].x + this.nodes[2].w  ||
       o[o.Pos[objID]][0].y + o[o.Pos[objID]][0].h / 2 <= this.nodes[2].y                    ||
       o[o.Pos[objID]][0].y - o[o.Pos[objID]][0].h / 2 >= this.nodes[2].y + this.nodes[2].h) == false) {
        this.nodes[2].deleteStatic(objID);
      }
      if((
       o[o.Pos[objID]][0].x + o[o.Pos[objID]][0].w / 2 <= this.nodes[3].x                    ||
       o[o.Pos[objID]][0].x - o[o.Pos[objID]][0].w / 2 >= this.nodes[3].x + this.nodes[3].w  ||
       o[o.Pos[objID]][0].y + o[o.Pos[objID]][0].h / 2 <= this.nodes[3].y                    ||
       o[o.Pos[objID]][0].y - o[o.Pos[objID]][0].h / 2 >= this.nodes[3].y + this.nodes[3].h) == false) {
        this.nodes[3].deleteStatic(objID);
      }
      if(this.checkForMerge == true) {
        this.checkForMerge = false;
        const object = [[], 0, [], 0];
        const objects = this.getObjects(object);
        if((object[1] + object[1] * (object[1] - 1) / 2) * (object[3] + 1) <= 10) {
          this.divided = false;
          this.DynamicCount = 0;
          for(var i = 0; i < object[1]; i++) {
            this.Dynamic[this.DynamicCount++] = object[0][i];
          }
          this.StaticCount = 0;
          for(i = 0; i < object[3]; i++) {
            this.Static[this.StaticCount++] = object[0][i];
          }
          if(this.parent != null) {
            this.parent.checkForMerge = 1;
          }
        }
      }
    }
  };
  QT.prototype.tick = function(updatedObjects, collidedObjects) {
    if(this.divided == false) {
      const pairs = new Array((this.DynamicCount + this.DynamicCount * (this.DynamicCount - 1) / 2) * (this.StaticCount + 1));
      var pairsCount = 0;
      for(var i = 0; i < this.DynamicCount;) {
        if(updatedObjects[this.Dynamic[i]] == null) {
          updatedObjects[this.Dynamic[i]] = 0;
          if(collidedObjects[this.Dynamic[i]] == null) {
            collidedObjects[this.Dynamic[i]] = {};
          }
          o[o.Pos[this.Dynamic[i]]][0].tick(SETTINGS);
        }
        if(
         (o[o.Pos[this.Dynamic[i]]][0].x - o[o.Pos[this.Dynamic[i]]][0].r <= this.x          && this.x          != e.x      ) ||
         (o[o.Pos[this.Dynamic[i]]][0].x + o[o.Pos[this.Dynamic[i]]][0].r >= this.x + this.w && this.x + this.w != e.x + e.w) ||
         (o[o.Pos[this.Dynamic[i]]][0].y - o[o.Pos[this.Dynamic[i]]][0].r <= this.y          && this.y          != e.y      ) ||
         (o[o.Pos[this.Dynamic[i]]][0].y + o[o.Pos[this.Dynamic[i]]][0].r >= this.y + this.h && this.y + this.h != e.y + e.h)) {
          e.insertDynamic(this.Dynamic[i]);
          if(
           o[o.Pos[this.Dynamic[i]]][0].x + o[o.Pos[this.Dynamic[i]]][0].r < this.x          ||
           o[o.Pos[this.Dynamic[i]]][0].x - o[o.Pos[this.Dynamic[i]]][0].r > this.x + this.w ||
           o[o.Pos[this.Dynamic[i]]][0].y + o[o.Pos[this.Dynamic[i]]][0].r < this.y          ||
           o[o.Pos[this.Dynamic[i]]][0].y - o[o.Pos[this.Dynamic[i]]][0].r > this.y + this.h) {
            this.Dynamic[i] = this.Dynamic[--this.DynamicCount];
            if(this.parent != null) {
              this.parent.checkForMerge = 1;
            }
          } else {
            if(o[o.Pos[this.Dynamic[i]]][0].CID != null) {
              for(var j = 0; j < pairsCount; j++) {
                const distance = Math.sqrt(Math.pow(o[o.Pos[this.Dynamic[i]]][0].x - o[o.Pos[pairs[j]]][0].x, 2) + Math.pow(o[o.Pos[this.Dynamic[i]]][0].y - o[o.Pos[pairs[j]]][0].y, 2));
                if(distance < o[o.Pos[this.Dynamic[i]]][0].cr + o[o.Pos[pairs[j]]][0].cr && collidedObjects[this.Dynamic[i]][pairs[j]] == null) {
                  collidedObjects[this.Dynamic[i]][pairs[j]] = 0;
                  if(collidedObjects[pairs[j]] == null) {
                    collidedObjects[pairs[j]] = {};
                  }
                  collidedObjects[pairs[j]][this.Dynamic[i]] = 0;
                  DynamicCollision(o[o.Pos[this.Dynamic[i]]][0], o[o.Pos[pairs[j]]][0], distance);
                }
              }
              pairs[pairsCount++] = this.Dynamic[i];
              for(j = 0; j < this.StaticCount; j++) {
                if(o[o.Pos[this.Static[j]]][0].CID != null) {
                  StaticCollision(o[o.Pos[this.Dynamic[i]]][0], o[o.Pos[this.Static[j]]][0]);
                }
              }
            }
            i++;
          }
        } else {
          if(o[o.Pos[this.Dynamic[i]]][0].CID != null) {
            for(var j = 0; j < pairsCount; j++) {
              const distance = Math.sqrt(Math.pow(o[o.Pos[this.Dynamic[i]]][0].x - o[o.Pos[pairs[j]]][0].x, 2) + Math.pow(o[o.Pos[this.Dynamic[i]]][0].y - o[o.Pos[pairs[j]]][0].y, 2));
              if(distance < o[o.Pos[this.Dynamic[i]]][0].cr + o[o.Pos[pairs[j]]][0].cr && collidedObjects[this.Dynamic[i]][pairs[j]] == null) {
                collidedObjects[this.Dynamic[i]][pairs[j]] = 0;
                if(collidedObjects[pairs[j]] == null) {
                  collidedObjects[pairs[j]] = {};
                }
                collidedObjects[pairs[j]][this.Dynamic[i]] = 0;
                DynamicCollision(o[o.Pos[this.Dynamic[i]]][0], o[o.Pos[pairs[j]]][0], distance);
              }
            }
            pairs[pairsCount++] = this.Dynamic[i];
            for(j = 0; j < this.StaticCount; j++) {
              if(o[o.Pos[this.Static[j]]][0].CID != null) {
                StaticCollision(o[o.Pos[this.Dynamic[i]]][0], o[o.Pos[this.Static[j]]][0]);
              }
            }
          }
          i++;
        }
      }
    } else {
      this.nodes[0].tick(updatedObjects, collidedObjects);
      this.nodes[1].tick(updatedObjects, collidedObjects);
      this.nodes[2].tick(updatedObjects, collidedObjects);
      this.nodes[3].tick(updatedObjects, collidedObjects);
      if(this.checkForMerge == true) {
        this.checkForMerge = false;
        const object = [[], 0, [], 0];
        this.getObjects(object);
        if((object[1] + object[1] * (object[1] - 1) / 2) * (object[3] + 1) <= 10) {
          this.divided = false;
          this.DynamicCount = 0;
          for(var i = 0; i < object[1]; i++) {
            this.Dynamic[this.DynamicCount++] = object[0][i];
          }
          this.StaticCount = 0;
          for(i = 0; i < object[3]; i++) {
            this.Static[this.StaticCount++] = object[0][i];
          }
          if(this.parent != null) {
            this.parent.checkForMerge = true;
          }
        }
      }
    }
  };
  const e = new QT(0, 0, SETTINGS.arenaW, SETTINGS.arenaH);
  const o = new Iterator(64e3, 64e3);
  return {
    insertDynamic: function(object) {
      e.firstInsertDynamic(object.QuadTreeID = o.add(object));
      return object.QuadTreeID;
    },
    insertStatic: function(object) {
      e.firstInsertStatic(object.QuadTreeID = o.add(object));
      return object.QuadTreeID;
    },
    deleteDynamic: function(objID) {
      e.deleteDynamic(objID);
      o.delete(objID);
    },
    deleteStatic: function(objID) {
      e.deleteStatic(objID);
      o.delete(objID);
    },
    tick: function(updatedObjects = {}) {
      const collidedObjects = {};
      e.tick(updatedObjects, collidedObjects);
    },
    query: function(x, y, w, h, predictd = 0, predicts = 0) {
      const object = [new Array(predictd), 0, new Array(predicts), 0];
      e.query(x, y, w, h, object);
      return object;
    },
    queryAll: function(x, y, w, h, predict = 0) {
      const object = [new Array(predict), 0];
      e.queryAll(x, y, w, h, object);
      return object;
    },
    objects: o
  };
}

DataView.prototype.setVarUint = function(offset, num) {
  if(num > 127) {
    this.setUint8(offset[0], num & 127 | 128);
    if(num > 16383) {
      this.setUint8(offset[0] + 1, num >> 7 & 127 | 128);
      if(num > 2097152) {
        this.setUint8(offset[0] + 2, num >> 14 & 127 | 128);
        if(num > 268435456) {
          this.setUint8(offset[0] + 3, num >> 21 & 127 | 128);
          this.setUint8(offset[0] + 4, num >> 28);
          offset[0] += 5;
        } else {
          this.setUint8(offset[0] + 3, num >> 21);
          offset[0] += 4;
        }
      } else {
        this.setUint8(offset[0] + 2, num >> 14);
        offset[0] += 3;
      }
    } else {
      this.setUint8(offset[0] + 1, num >> 7);
      offset[0] += 2;
    }
  } else {
    this.setUint8(offset[0]++, num);
  }
};
DataView.prototype.setVarInt = function(offset, num) {
  if(num < 0) {
    this.setVarUint(offset, ~num << 1 | 1);
  } else {
    this.setVarUint(offset, num << 1);
  }
};
DataView.prototype.setString = function(offset, string) {
  for(var i = 0; i < string.length; i++) {
    this.setVarUint(offset, string.charCodeAt(i));
  }
  this.setUint8(offset[0]++, 0);
};
DataView.prototype.out = function(offset) {
  return new Uint8Array(this.buffer).subarray(this.byteOffset, offset);
};

function IncomingWrapper(message) {
  this.buffer = message;
};
IncomingWrapper.prototype.getUint8 = function(offset) {
  return this.buffer[offset[0]++];
};
IncomingWrapper.prototype.getUint16 = function(offset) {
  offset[0] += 2;
  return this.buffer[offset[0] - 2] << 8 | this.buffer[offset[0] - 1];
};
IncomingWrapper.prototype.getUint24 = function(offset) {
  offset[0] += 3;
  return this.buffer[offset[0] - 3] << 16 | (this.buffer[offset[0] - 2] << 8) | this.buffer[offset[0] - 1];
};
IncomingWrapper.prototype.getUint32 = function(offset) {
  offset[0] += 4;
  return this.buffer[offset[0] - 4] << 24 | (this.buffer[offset[0] - 3] << 16) | (this.buffer[offset[0] - 2] << 8) | this.buffer[offset[0] - 1];
};
IncomingWrapper.prototype.getVarUint = function(offset) {
  const one = this.buffer[offset[0]];
  if(one >> 7 == 1) {
    const two = this.buffer[offset[0] + 1];
    if(two >> 7 == 1) {
      const three = this.buffer[offset[0] + 2];
      if(three >> 7 == 1) {
        const four = this.buffer[offset[0] + 3];
        if(four >> 7 == 1) {
          offset[0] += 5;
          return this.buffer[offset[0] - 1] << 28 | ((four & 127) << 21) | ((three & 127) << 14) | ((two & 127) << 7) | (one & 127);
        } else {
          offset[0] += 4;
          return four << 21 | ((three & 127) << 14) | ((two & 127) << 7) | (one & 127);
        }
      } else {
        offset[0] += 3;
        return three << 14 | ((two & 127) << 7) | (one & 127);
      }
    } else {
      offset[0] += 2;
      return two << 7 | (one & 127);
    }
  } else {
    offset[0]++;
    return one;
  }
};
IncomingWrapper.prototype.getVarInt = function(offset) {
  const num = this.getVarUint(offset);
  if(num & 1 == 1) {
    return ~(num >> 1);
  } else {
    return num >> 1;
  }
};
IncomingWrapper.prototype.getString = function(offset) {
  var str = '';
  var num = 0;
  while((num = this.getVarUint(offset)) != 0) {
    str += String.fromCharCode(num);
  }
  return str;
};
IncomingWrapper.prototype.tryGetString = function(offset) {
  var str = '';
  var num = 0;
  while((num = this.getVarUint(offset)) != 0 && offset[0] <= this.buffer.length) {
    str += String.fromCharCode(num);
  }
  if(offset[0] <= this.buffer.length) {
    return [0, str];
  } else {
    return [1, str];
  }
};

const GENERAL_BUFFER = new ArrayBuffer(16777215);
const GENERAL = new DataView(GENERAL_BUFFER);
const SIDE_BUFFER = new ArrayBuffer(16777215);
const SIDE = new DataView(SIDE_BUFFER);

function Lerp(x, dest, jump, min) {
  return x + Math.max(Math.min(min, dest - x), (dest - x) * jump);
}

class Entity {
  constructor(x, y, angle, color, CID, PID) {
    [this.x, this.y, this.angle, this.color, this.PID] = [x, y, angle, color, PID];
    this.opacity = 255;
    if(CID != null) {
      this.CID = CID;
    }
  }
}
class StaticCircle extends Entity {
  constructor(x, y, r, angle, color, CID, PID) {
    super(x, y, angle, color, CID, PID);
    [this.w, this.h, this.type, this.a] = [r, r, 0, r];
  }
}
class StaticTriangle extends Entity {
  constructor(x, y, a, angle, color, CID, PID) {
    super(x, y, angle, color, CID, PID);
    [this.w, this.h, this.type, this.a] = [a * 0.5773502691896257, a * 0.5773502691896257, 1, a];
  }
}
class StaticRectangle extends Entity {
  constructor(x, y, w, h, angle, color, CID, PID) {
    super(x, y, angle, color, CID, PID);
    [this.w, this.h, this.type, this.a, this.b] = [w, h, 2, w, h];
  }
}
class StaticPentagon extends Entity {
  constructor(x, y, a, angle, color, CID, PID) {
    super(x, y, angle, color, CID, PID);
    [this.w, this.h, this.type, this.a] = [a * 0.7694208842938134, a * 0.7694208842938134, 3, a];
  }
}
class StaticTrapez extends Entity {
  constructor(x, y, a, b, c, angle, color, CID, PID) {
    super(x, y, angle, color, CID, PID);
    [this.w, this.h, this.type, this.a, this.b, this.c] = [a, -Math.sin(Math.PI * b / 254 - Math.PI) * c, 4, a, b, c];
  }
}
class DynamicEntity extends Entity {
  constructor(x, y, vx, vy, angle, color, CID, PID, parent) {
    super(x, y, angle, color, CID, PID);
    [this.vx, this.vy, this.parent] = [vx, vy, parent];
  }
  tick(settings) {
    this.x += this.vx;
    this.y += this.vy;
    this.logic();
    if(this.x - this.r < 0) {
      this.x = this.r;
      this.vx = 0;
    } else if(this.x + this.r > settings.arenaW) {
      this.x = settings.arenaW - this.r;
      this.vx = 0;
    }
    if(this.y - this.r < 0) {
      this.y = this.r;
      this.vy = 0;
    } else if(this.y + this.r > settings.arenaH) {
      this.y = settings.arenaH - this.r;
      this.vy = 0;
    }
  }
  logic() {}
}
class DynamicCircle extends DynamicEntity {
  constructor(x, y, r, vx, vy, angle, color, CID, PID, parent) {
    super(x, y, vx, vy, angle, color, CID, PID, parent);
    [this.r, this.type, this.a, this.cr] = [r, 0, r, r];
  }
}
class DynamicTriangle extends DynamicEntity {
  constructor(x, y, a, vx, vy, angle, color, CID, PID, parent) {
    super(x, y, vx, vy, angle, color, CID, PID, parent);
    [this.r, this.type, this.a, this.cr] = [a * 0.5773502691896257, 1, a, a * 0.28867513459481287];
  }
}
class DynamicRectangle extends DynamicEntity {
  constructor(x, y, w, h, vx, vy, angle, color, CID, PID, parent) {
    super(x, y, vx, vy, angle, color, CID, PID, parent);
    [this.r, this.type, this.a, this.b, this.cr] = [Math.sqrt((w ** 2 + h ** 2) / 4), 2, w, h, w / 2];
  }
}
class DynamicPentagon extends DynamicEntity {
  constructor(x, y, a, vx, vy, angle, color, CID, PID, parent) {
    super(x, y, vx, vy, angle, color, CID, PID, parent);
    [this.r, this.type, this.a, this.cr] = [a * 0.7694208842938134, 3, a, a * 0.8660254037844386];
  }
}
class DynamicTrapez extends DynamicEntity {
  constructor(x, y, a, b, c, vx, vy, angle, color, CID, PID, parent) {
    super(x, y, vx, vy, angle, color, CID, PID, parent);
    [this.r, this.type, this.a, this.b, this.c] = [Math.sqrt((a ** 2 + c ** 2 * Math.sin(b) ** 2) / 4), 4, a, b, c];
  }
}

class Square extends DynamicRectangle {
  constructor(x, y) {
    super(x, y, DATA.shapes.square.r, DATA.shapes.square.r, Math.random() - 0.5, Math.random() - 0.5, Math.random() * 1024, DATA.shapes.square.color, DATA.shapes.CID, DATA.shapes.PID);
    this.direction = Math.random() * Math.PI * 2;
  }
  logic() {
    if((this.angle += 3) > 1023) {
      this.angle = 0;
    }
    const length = Math.sqrt(this.vx ** 2 + this.vy ** 2);
    if(length > 0.5) {
      this.vx = Lerp(this.vx, this.vx / length, 0.1, 0.001);
      this.vy = Lerp(this.vy, this.vy / length, 0.1, 0.001);
    }
    if(this.angle % 66 == 0) {
      this.direction += Math.random() - 0.5;
      this.vx = Lerp(this.vx, this.vx + Math.cos(this.direction) * 0.3, 0.1, 0.001);
      this.vy = Lerp(this.vy, this.vy + Math.sin(this.direction) * 0.3, 0.1, 0.001);
    }
  }
}

const Player = function(ws, game) {
  this.ws = ws;
  this.game = game;
  
  this.clientID = this.game.clients.add(this);
  
  this.entity = null;
  this.entityID = null;
  this.seeksEntityID = false;
  this.gotEntityID = false;
  this.spawnedAt = 0;
  this.lifeLength = 0;
  this.died = false;
  this.diedBy = '';
  this.name = '';
  
  this.xp = 0;
  this.level = 1;
  this.fov = 1;
  this.targetFov = 3;
  
  this.gridSize = 0;
  this.gridX = 0;
  this.gridY = 0;
  
  this.camera = [this.game.settings.arenaW / 2, this.game.settings.arenaH / 2];
  this.boundMinX = this.camera[0] - 960 * this.fov;
  this.boundMinY = this.camera[1] - 540 * this.fov;
  this.boundMaxX = this.camera[0] + 960 * this.fov;
  this.boundMaxY = this.camera[1] + 540 * this.fov;
  this.sentMinX = false;
  this.sentMinY = false;
  this.sentMaxX = false;
  this.sentMaxY = false;
  this.target = null;
  
  this.showHiddenEntities = false;
  
  this.entities = new Iterator();
  this.oldProp = {};
};
Player.prototype.end = function() {
  void this.maybeDie();
  this.game.clients.delete(this.clientID);
};
Player.prototype.spawn = function(name) {
  this.entity = new DynamicCircle((30 + Math.random() * (this.game.settings.arenaW - 60)) | 0, (30 + Math.random() * (this.game.settings.arenaH - 60)) | 0, DATA.tanks.basic.r, 7, 0, 0, DATA.tanks.basic.color, DATA.player.CID, DATA.player.PID);
  this.entity.name = name;
  void this.game.engine.insertDynamic(this.entity);
  this.spawnedAt = new Date().getTime();
  this.seeksEntityID = true;
  this.targetFov = 1;
};
Player.prototype.die = function() {
  // fade away first
  this.lifeLength = new Date().getTime() - this.spawnedAt;
  this.died = true; // TODO: include this in packets
  this.game.engine.deleteDynamic(this.entity.QuadTreeID);
  this.entity = null;
  this.gotEntityID = true;
  this.entityID = 0;
};
Player.prototype.maybeDie = function() {
  if(this.entity != null) {
    this.die();
    return true;
  }
  return false;
};
Player.prototype.moveCamera = function(x, y) {
  this.camera = [x, y];
  this.boundMinX = this.camera[0] - 960 * this.fov;
  this.boundMinY = this.camera[1] - 540 * this.fov;
  this.boundMaxX = this.camera[0] + 960 * this.fov;
  this.boundMaxY = this.camera[1] + 540 * this.fov;
};
Player.prototype.Unpack = function(message) {
  const view = new IncomingWrapper(new Uint8Array(message));
  //var offset = 0;
  switch(view.buffer[0]) {
    case 1: {
      this.ws._send(new Uint8Array([1]), true, false);
      break;
    }
    case 4: {
      var name = '';
      if(this.entity == null && (name = view.tryGetString([1]), name[0] == 0)) {
        this.spawn(name[1]);
      } else {
        this.ws.close();
      }
      break;
    }
    default: {
      this.ws.close();
      break;
    }
  }
};
Player.prototype.createEntity = function(entityID, offset) {
  const entity = this.game.engine.objects[this.game.engine.objects.Pos[entityID]][0];
  const e = {
    QuadTreeID: entityID,
    x: ((entity.x - this.camera[0]) / this.fov + 960) * 32 + 0.5 | 0,
    y: ((entity.y - this.camera[1]) / this.fov + 540) * 32 + 0.5 | 0,
    angle: entity.angle,
    type: entity.type,
    a: entity.a / this.fov * 32 + 0.5 | 0,
    opacity: entity.opacity,
    color: entity.color,
    PID: entity.PID
  };
  const ID = this.entities.add(e);
  GENERAL.setVarUint(offset, this.entities.Pos[ID]);
  GENERAL.setVarInt(offset, e.x);
  GENERAL.setVarInt(offset, e.y);
  GENERAL.setUint16(offset[0], e.angle);
  GENERAL.setUint8(offset[0] + 2, e.color);
  GENERAL.setUint8(offset[0] + 3, e.PID);
  GENERAL.setUint8(offset[0] + 4, e.type);
  offset[0] += 5;
  GENERAL.setVarUint(offset, e.a);
  if(entity.c == null) {
    if(entity.b != null) {
      e.b = entity.b / this.fov * 32 + 0.5 | 0;
      GENERAL.setVarUint(offset, e.b);
    }
  } else {
    e.b = entity.b;
    e.c = entity.c / this.fov * 32 + 0.5 | 0;
    GENERAL.setUint8(offset[0]++, e.b);
    GENERAL.setVarUint(offset, e.c);
  }
  var lastIndex = 0;
  if(entity.name != null) {
    e.name = entity.name;
    GENERAL.setUint8(offset[0]++, 1 - lastIndex);
    GENERAL.setString(offset, e.name);
    lastIndex = 1;
  }
  if(e.opacity != 255) {
    GENERAL.setUint8(offset[0], 2 - lastIndex);
    GENERAL.setUint8(offset[0] + 1, e.opacity);
    offset[0] += 2;
    lastIndex = 2;
  }
  if(entity.t != null) {
    e.t = entity.t / this.fov * 32 + 0.5 | 0;
    GENERAL.setUint8(offset[0]++, 3 - lastIndex);
    GENERAL.setVarUint(offset, e.t);
    lastIndex = 3;
  }
  GENERAL.setUint8(offset[0]++, 0);
  if(this.seeksEntityID == true && this.entity.QuadTreeID == entityID) {
    this.seeksEntityID = false;
    this.entityID = this.entities.Pos[ID] + 1;
    this.gotEntityID = true;
  }
};
Player.prototype.Pack = function() {
  this.fov = Lerp(this.fov, this.targetFov, 0.1, 0.001);
  if(this.target != null) {
    this.moveCamera(Lerp(this.camera[0], this.target.x, 0.5, 0.001), Lerp(this.camera[1], this.target.y, 0.5, 0.001));
  } else if(this.entity != null) {
    this.moveCamera(Lerp(this.camera[0], this.entity.x, 0.5, 0.001), Lerp(this.camera[1], this.entity.y, 0.5, 0.001));
  } else {
    this.moveCamera(Lerp(this.camera[0], this.game.settings.arenaW / 2, 0.5, 0.001), Lerp(this.camera[1], this.game.settings.arenaH / 2, 0.5, 0.001));
    this.targetFov = 2.2;
  }
  
  var j = 0;
  var has = false;
  var entity = null;
  
  var temp = 0;
  var gridChanged = false;
  var x = 0;
  var y = 0;
  var a = 0;
  var b = null;
  var c = null;
  var t = null;
  
  var lastIndex = 0;
  
  GENERAL.setUint8(0, 0);
  var main_offset = [1];
  
  if(this.xp != this.oldProp.xp) {
    GENERAL.setUint8(main_offset[0]++, 1 - lastIndex);
    GENERAL.setVarUint(main_offset, this.xp);
    this.oldProp.xp = this.xp;
    lastIndex = 1;
  }
  if(this.level != this.oldProp.level) {
    GENERAL.setUint8(main_offset[0]++, 2 - lastIndex);
    GENERAL.setVarUint(main_offset, this.level);
    this.oldProp.level = this.level;
    lastIndex = 2;
  }
  if(this.boundMinX < 0) {
    temp = Math.min(-this.boundMinX / this.fov, 1920) * 32 + 0.5 | 0;
    if(this.oldProp.boundMinX - temp != 0) {
      GENERAL.setUint8(main_offset[0], 3 - lastIndex);
      GENERAL.setUint16(main_offset[0] + 1, temp);
      main_offset[0] += 3;
      lastIndex = 3;
      this.sentMinX = false;
      this.oldProp.boundMinX = temp;
    }
  } else if(this.sentMinX == false) {
    GENERAL.setUint8(main_offset[0], 3 - lastIndex);
    GENERAL.setUint16(main_offset[0] + 1, 0);
    main_offset[0] += 3;
    lastIndex = 3;
    this.sentMinX = true;
    this.oldProp.boundMinX = 0;
  }
  if(this.boundMaxX > this.game.settings.arenaW) {
    temp = Math.min((this.boundMaxX - this.game.settings.arenaW) / this.fov, 1920) * 32 + 0.5 | 0;
    if(this.oldProp.boundMaxX - temp != 0) {
      GENERAL.setUint8(main_offset[0], 4 - lastIndex);
      GENERAL.setUint16(main_offset[0] + 1, temp);
      main_offset[0] += 3;
      lastIndex = 4;
      this.sentMaxX = false;
      this.oldProp.boundMaxX = temp;
    }
  } else if(this.sentMaxX == false) {
    GENERAL.setUint8(main_offset[0], 4 - lastIndex);
    GENERAL.setUint16(main_offset[0] + 1, 0);
    main_offset[0] += 3;
    lastIndex = 4;
    this.sentMaxX = true;
    this.oldProp.boundMaxX = 0;
  }
  if(this.boundMinY < 0) {
    temp = Math.min(-this.boundMinY / this.fov, 1080) * 32 + 0.5 | 0;
    if(this.oldProp.boundMinY - temp != 0) {
      GENERAL.setUint8(main_offset[0], 5 - lastIndex);
      GENERAL.setUint16(main_offset[0] + 1, temp);
      main_offset[0] += 3;
      lastIndex = 5;
      this.sentMinY = false;
      this.oldProp.boundMinY = temp;
    }
  } else if(this.sentMinY == false) {
    GENERAL.setUint8(main_offset[0], 5 - lastIndex);
    GENERAL.setUint16(main_offset[0] + 1, 0);
    main_offset[0] += 3;
    lastIndex = 5;
    this.sentMinY = true;
    this.oldProp.boundMinY = 0;
  }
  if(this.boundMaxY > this.game.settings.arenaH) {
    temp = Math.min((this.boundMaxY - this.game.settings.arenaH) / this.fov, 1080) * 32 + 0.5 | 0;
    if(this.oldProp.boundMaxY - temp != 0) {
      GENERAL.setUint8(main_offset[0], 6 - lastIndex);
      GENERAL.setUint16(main_offset[0] + 1, temp);
      main_offset[0] += 3;
      lastIndex = 6;
      this.sentMaxY = false;
      this.oldProp.boundMaxY = temp;
    }
  } else if(this.sentMaxY == false) {
    GENERAL.setUint8(main_offset[0], 6 - lastIndex);
    GENERAL.setUint16(main_offset[0] + 1, 0);
    main_offset[0] += 3;
    lastIndex = 6;
    this.sentMaxY = true;
    this.oldProp.boundMaxY = 0;
  }
  if(this.gotEntityID == true) {
    GENERAL.setUint8(main_offset[0]++, 7 - lastIndex);
    GENERAL.setVarUint(main_offset, this.entityID);
    lastIndex = 7;
    this.gotEntityID = false;
  }
  if((temp = SERVER_SETTINGS.gridSize / this.fov * 65536 + 0.5 | 0) != this.gridSize) {
    GENERAL.setUint8(main_offset[0]++, 8 - lastIndex);
    GENERAL.setVarUint(main_offset, temp);
    lastIndex = 8;
    this.gridSize = temp;
    gridChanged = true;
  }
  if((temp = Math.abs(this.camera[0] * 4096) + 0.5 | 0) != this.gridX || gridChanged == true) {
    GENERAL.setUint8(main_offset[0]++, 9 - lastIndex);
    GENERAL.setVarUint(main_offset, (3932160 - ((this.camera[0] - SERVER_SETTINGS.gridSize) % SERVER_SETTINGS.gridSize) / this.fov * 4096) % (this.gridSize / 16) + 0.5 | 0);
    lastIndex = 9;
    this.gridX = temp;
  }
  if((temp = Math.abs(this.camera[1] * 4096) + 0.5 | 0) != this.gridY || gridChanged == true) {
    GENERAL.setUint8(main_offset[0]++, 10 - lastIndex);
    GENERAL.setVarUint(main_offset, (2211840 - ((this.camera[1] - SERVER_SETTINGS.gridSize) % SERVER_SETTINGS.gridSize) / this.fov * 4096) % (this.gridSize / 16) + 0.5 | 0);
    lastIndex = 10;
    this.gridY = temp;
  }
  GENERAL.setUint8(main_offset[0]++, 0);
  
  SIDE.setUint8(0, 2);
  var side_offset = [1];
  
  const entities = Array.from(this.entities);
  var length = this.entities.Count;
  const objects = this.game.engine.queryAll(this.boundMinX, this.boundMinY, 1920 * this.fov, 1080 * this.fov);
  for(var i = 0; i < objects[1]; i++) {
    if(length == 0) {
      this.createEntity(objects[0][i], main_offset);
      continue;
    }
    for(j = 0; j < length; j++) {
      if(entities[j][0].QuadTreeID == objects[0][i]) { // update
        entity = this.game.engine.objects[this.game.engine.objects.Pos[objects[0][i]]][0];
        x = ((entity.x - this.camera[0]) / this.fov + 960) * 32 + 0.5 | 0;
        y = ((entity.y - this.camera[1]) / this.fov + 540) * 32 + 0.5 | 0;
        a = entity.a / this.fov * 32 + 0.5 | 0;
        switch(entity.type) {
          case 2: {
            b = entity.b / this.fov * 32 + 0.5 | 0;
            break;
          }
          case 4: {
            b = entity.b;
            c = entity.c / this.fov * 32 + 0.5 | 0;
            break;
          }
          default: {
            b = null;
            c = null;
            break;
          }
        }
        if(entity.t != null) {
          t = entity.t / this.fov * 32 + 0.5 | 0;
        } else {
          t = null;
        }
        if(
          x != entities[j][0].x ||
          y != entities[j][0].y ||
          entity.angle != entities[j][0].angle ||
          a != entities[j][0].a ||
          b != entities[j][0].b ||
          entity.color != entities[j][0].color ||
          c != entities[j][0].c ||
          t != entities[j][0].t ||
          entity.opacity != entities[j][0].opacity ||
          entity.type != entities[j][0].type
        ) {
          if(this.showHiddenEntities == true || entity.opacity != 0) {
            GENERAL.setVarUint(main_offset, this.entities.Pos[entities[j][1]]);
            lastIndex = 0;
            if(x != entities[j][0].x) {
              GENERAL.setUint8(main_offset[0]++, 1 - lastIndex);
              GENERAL.setVarInt(main_offset, x);
              this.entities[this.entities.Pos[entities[j][1]]][0].x = x;
              lastIndex = 1;
            }
            if(y != entities[j][0].y) {
              GENERAL.setUint8(main_offset[0]++, 2 - lastIndex);
              GENERAL.setVarInt(main_offset, y);
              this.entities[this.entities.Pos[entities[j][1]]][0].y = y;
              lastIndex = 2;
            }
            if(entities[j][0].angle != entity.angle) {
              GENERAL.setUint8(main_offset[0], 3 - lastIndex);
              GENERAL.setUint16(main_offset[0] + 1, entity.angle);
              main_offset[0] += 3;
              this.entities[this.entities.Pos[entities[j][1]]][0].angle = entity.angle;
              lastIndex = 3;
            }
            if(entities[j][0].type != entity.type) {
              GENERAL.setUint8(main_offset[0], 4 - lastIndex);
              GENERAL.setUint8(main_offset[0] + 1, entity.type);
              main_offset[0] += 2;
              this.entities[this.entities.Pos[entities[j][1]]][0].type = entity.type;
              lastIndex = 4;
            }
            if(entities[j][0].a != a) {
              GENERAL.setUint8(main_offset[0]++, 5 - lastIndex);
              GENERAL.setVarUint(main_offset, a);
              this.entities[this.entities.Pos[entities[j][1]]][0].a = a;
              lastIndex = 5;
            }
            if(entities[j][0].b != b) {
              if(entity.type == 2) {
                GENERAL.setUint8(main_offset[0]++, 6 - lastIndex);
                GENERAL.setVarUint(main_offset, b);
              } else {
                GENERAL.setUint8(main_offset[0], 6 - lastIndex);
                GENERAL.setUint8(main_offset[0] + 1, b);
                main_offset[0] += 2;
              }
              this.entities[this.entities.Pos[entities[j][1]]][0].b = b;
              lastIndex = 6;
            }
            if(entities[j][0].c != c) {
              GENERAL.setUint8(main_offset[0]++, 7 - lastIndex);
              GENERAL.setVarUint(main_offset, c);
              this.entities[this.entities.Pos[entities[j][1]]][0].c = c;
              lastIndex = 7;
            }
            if(entities[j][0].t != t) {
              GENERAL.setUint8(main_offset[0]++, 8 - lastIndex);
              GENERAL.setVarUint(main_offset, t);
              this.entities[this.entities.Pos[entities[j][1]]][0].t = t;
              lastIndex = 8;
            }
            if(entities[j][0].color != entity.color) {
              GENERAL.setUint8(main_offset[0], 9 - lastIndex);
              GENERAL.setUint8(main_offset[0] + 1, entity.color);
              main_offset[0] += 2;
              this.entities[this.entities.Pos[entities[j][1]]][0].color = entity.color;
              lastIndex = 9;
            }
            if(entities[j][0].opacity != entity.opacity) {
              GENERAL.setUint8(main_offset[0], 10 - lastIndex);
              GENERAL.setUint8(main_offset[0] + 1, entity.opacity);
              main_offset[0] += 2;
              this.entities[this.entities.Pos[entities[j][1]]][0].opacity = entity.opacity;
              lastIndex = 10;
            }
            GENERAL.setUint8(main_offset[0]++, 0);
            entities[j] = entities[--length];
          }
        } else {
          entities[j] = entities[--length];
        }
        break;
      } else if(j == length - 1) { // create
        this.createEntity(objects[0][i], main_offset);
      }
    }
  }
  for(i = 0; i < length; i++) {
    SIDE.setVarUint(side_offset, this.entities.Pos[entities[i][1]]);
    this.entities.delete(entities[i][1]);
  }
  
  if(main_offset[0] != 2) {
    if(side_offset[0] != 1) {
      this.ws.cork(function() {
        this.send(GENERAL.out(main_offset));
        this.send(SIDE.out(side_offset));
      }.bind(this.ws));
    } else {
      this.ws.send(GENERAL.out(main_offset));
    }
  } else if(side_offset[0] != 1) {
    this.ws.send(SIDE.out(side_offset));
  }
};

const Games = new Iterator(1);

function CreateGame(SETTINGS) {
  const ENGINE = new QuadTree(SETTINGS);
  const CLIENTS = new Iterator(SERVER_SETTINGS.maxPlayers, SERVER_SETTINGS.maxPlayers);
  const LOOPER = setInterval(function() {
    for(var i = 0; i < CLIENTS.Count; i++) {
      if(CLIENTS[i][0].ws.verified == true) {
        CLIENTS[i][0].Pack();
      }
    }
    ENGINE.tick();
  }, SETTINGS.tickTime);
  for(var i = 0; i < 50; i++) {
    ENGINE.insertDynamic(new Square((DATA.shapes.square.r + Math.random() * (SETTINGS.arenaW - DATA.shapes.square.r * 2)), (DATA.shapes.square.r + Math.random() * (SETTINGS.arenaH - DATA.shapes.square.r * 2))));
  }
  const US = { engine: ENGINE, clients: CLIENTS, looper: LOOPER, settings: SETTINGS };
  US.id = Games.add(US);
  return US;
}

const uWebSocket = require('uWebSockets.js');
var server = null;

function parseIP(IP) {
  var number = 0;
  for(var i = 0; i < IP.length; i++) {
    if(IP[i] != '.') {
      number *= 10;
      number += IP.charCodeAt(i) - 48;
    }
  }
  return number;
}
function Upgrader(res, req, context) {
  const IP = parseIP(req.getHeader('x-forwarded-for'));
  /*
  if(req.getHeader('origin').match(/http?s\:\/\/shadam\.lol/) == null) { // can most probably be handled by nginx too
    return res.writeStatus(403).end();
  }
  */
  res.upgrade({}, req.getHeader('sec-websocket-key'), req.getHeader('sec-websocket-protocol'), req.getHeader('sec-websocket-extensions'), context);
}
function Opener(ws) {
  ws.closed = false;
  ws.verified = false;
  
  ws._send = ws.send;
  ws._buffer = [];
  ws.send = function(message) {
    if(ws.getBufferedAmount() - SERVER_SETTINGS.maxBackpressure < 0) {
      ws._send(message, true, true);
    } else {
      ws._buffer[ws._buffer.length] = message;
    }
  };
  
  ws.buildTimeout = setTimeout(function() {
    if(ws.closed == false && ws.verified == false) {
      ws.close();
    }
  }, 1e3);
}
function Messager(ws, message, isBinary) {
  if(ws.verified == true) {
    if(isBinary == true) {
      ws.player.Unpack(message);
    } else {
      ws.close();
    }
  } else if(new IncomingWrapper(new Uint8Array(message)).getVarUint([0]) == SERVER_SETTINGS.build) {
    ws.verified = true;
    ws.player = new Player(ws, Games[0][0]);
    ws._send(new Uint8Array([1]), true, false);
  } else {
    ws.end(4000);
  }
}
function Drainer(ws) {
  while(ws._buffer.length != 0 && ws.getBufferedAmount() - SERVER_SETTINGS.maxBackpressure < 0) ws._send(ws._buffer.shift(), true, true);
}
function Closer(ws, code, message) {
  ws.closed = true;
  if(ws.player != null) {
    ws.player.end();
  }
}

function StartServer() {
  switch(SERVER_SETTINGS.gamemode) {
    case 'FFA': {
      CreateGame(FFA_SETTINGS);
      break;
    }
  }
  uWebSocket./*SSL*/App(/*{
    key_file_name: './util/key.pem',
    cert_file_name: './util/cert.pem',
    passphrase: '1234'
  }*/).ws('/*', {
    compression: uWebSocket.SHARED_COMPRESSOR,
    idleTimeout: 0,
    maxBackpressure: SERVER_SETTINGS.maxBackpressure,
    upgrade: Upgrader,
    open: Opener,
    message: Messager,
    drain: Drainer,
    close: Closer
  }).any('/*', function(res, req) {
    res.writeStatus('426').end();
  }).listen(SERVER_SETTINGS.port, function(token) {
    if(token) {
      server = token;
      console.log(`Successfully started WebSocket server on port ${SERVER_SETTINGS.port}.`);
    } else {
      console.log(`Could not bind to port ${SERVER_SETTINGS.port}, most probably taken already.`);
    }
  });
}
StartServer();

function StopServer() {
  if(server != null) {
    uWebSocket.us_listen_socket_close(server);
    server = null;
    console.log('Successfully stopped the WebSocket server.');
  } else {
    console.log('The WebSocket server is not running.');
  }
}
function StopGame(id) { // 'arena closed.' and ac spawning?
  
  //clearInterval(Games[id].looper); // at the end, and also kill all the client connections
}

process.on('SIGINT', async function() {
  StopServer();
  for(var i = 0; i < Games.Count; i++) {
    console.log(`Closing game ${Games[i][0].id}`);
    await StopGame(Games[i][0].id);
    console.log(`Closed game ${Games[i][0].id}`);
  }
  if(Games.Count != 0) {
    console.log(`Closed all games.`);
  }
  process.exit();
});
