//---------------------------------------------------------------------------
// ArcNode
//---------------------------------------------------------------------------

var nodeId = 0;

var ArcNode = function(site) {
  this.site = site;
  this.isArc = true;
  this.isEdge = false;
}

Object.defineProperty(ArcNode.prototype, "id", {
  configurable: true,
  enumerable: true,
  get: function() {
    return this.site.id;
  },
});

//------------------------------------------------------------
// prevEdge
// Returns the previous in-order edge arcNode. Find the first
// ancestor to the left.
//------------------------------------------------------------
ArcNode.prototype.prevEdge = function() {
  var node = this;
  while (node.parent != null && node.parent.left == node) {
    node = node.parent;
  }
  return node.parent;
}

//------------------------------------------------------------
// prevArc
// Returns the previous in-order arc arcNode
//------------------------------------------------------------
ArcNode.prototype.prevArc = function() {
  var node = this.prevEdge();
  if (node == null) return null;
  return node.prevArc();
}

//------------------------------------------------------------
// nextEdge
// Returns the next in-order edge node. Find the first
// ancestor to the right.
//------------------------------------------------------------
ArcNode.prototype.nextEdge = function() {
  var node = this;
  while (node.parent != null && node.parent.right == node) {
    node = node.parent;
  }
  return node.parent;
}

//------------------------------------------------------------
// nextArc
// Returns the next in-order arc arcNode. 
//------------------------------------------------------------
ArcNode.prototype.nextArc = function() {
  var node = this.nextEdge();
  if (node == null) return null;
  return node.nextArc();
}

//---------------------------------------------------------------------------
// EdgeNode
//---------------------------------------------------------------------------

//------------------------------------------------------------
// EdgeNode
// left and right are the left and right children.
//------------------------------------------------------------
var EdgeNode = function(left_, right, vertex) {
  this.isArc = false;
  this.isEdge = true;
  this.left = left_;
  this.right = right;

  this.updateEdge(vertex);

  left_.parent = this;
  right.parent = this;

  this.toDot = function() {
    return "\"" + this.id + "\"";
  };
}

Object.defineProperty(EdgeNode.prototype, "id", {
  configurable: true,
  enumerable: true,
  get: function() {
    return this.prevArc().site.id + "-" + this.nextArc().site.id;
  },
});

EdgeNode.prototype.updateEdge = function(vertex) {
  this.dcelEdge = dcel.makeEdge();
  this.dcelEdge.origin.point = vertex;
  this.dcelEdge.a = this.prevArc().site.id;
  this.dcelEdge.b = this.nextArc().site.id;
}

EdgeNode.prototype.prevArc = function() {
  var node = this;
  node = node.left;
  while (!node.isArc) {
    node = node.right;
  }
  return node;
}

EdgeNode.prototype.nextArc = function() {
  var node = this;
  node = node.right;
  while (!node.isArc) {
    node = node.left;
  }
  return node;
}

EdgeNode.prototype.getChild = function(side) {
  if (side == LEFT_CHILD) return this.left;
  return this.right;
}

EdgeNode.prototype.setChild = function(node, side) {
  if (side == LEFT_CHILD) {
    this.left = node;
  } else {
    this.right = node;
  }
  node.parent = this;
}

EdgeNode.prototype.intersection = function(directrix) {
  // This is inefficient. We should be storing sites in edge nodes.
  var pleft = createParabola(this.prevArc().site, directrix);
  var pright = createParabola(this.nextArc().site, directrix);
  var intersections = pleft.intersect(pright);
  if (intersections.length == 1) return intersections[0];
  if (pleft.focus.y > pright.focus.y) return intersections[0];
  return intersections[1];
};
