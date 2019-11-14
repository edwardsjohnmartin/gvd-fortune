"use strict";

// let g_edgeDataset = [];
let g_edgex0SortedDataset = [];
let g_edgex1SortedDataset = [];
let g_currentHighlightedPaths = [];
// let highlightColor = "yellow";

// priority queue
// let queue = [];

let g_pathIds = [];
// TODO highlight all vertices
let g_vertexIds = [];

function setSortedDatasets(allEdges){
  var dataset = [];
  _.forEach(allEdges, function (e) {
    if (!e.origin.point || !e.dest.point) throw "invalid edge detected";
    var obj = {
      x0: e.origin.point[0],
      x1: e.dest.point[0],
      y0: e.origin.point[1],
      y1: e.dest.point[1],
      id: getEdgeId(e),
      cost: distance(e),
      tCost: undefined,
      previousEdge: undefined // may not need this anymore
    };
    dataset.push(obj);
  });
  // must be a reference to
  g_edgex0SortedDataset = _.sortBy(dataset, 'x0');
  g_edgex1SortedDataset = _.sortBy(dataset, 'x1');
}

function clearPathInfo() {
  for (var i = 0; i < g_edgex0SortedDataset.length; i++) {
    g_edgex0SortedDataset[i].path = [];
    g_edgex0SortedDataset[i].tCost = undefined;
  }

  for (var i = 0; i < g_edgex1SortedDataset.length; i++) {
    g_edgex1SortedDataset[i].path = [];
    g_edgex1SortedDataset[i].tCost = undefined;
  }
}

function distance(dcelEdge) {
  var x0 = dcelEdge.origin.point[0];
  var x1 = dcelEdge.dest.point[0];
  var y0 = dcelEdge.origin.point[1];
  var y1 = dcelEdge.dest.point[1];
  var dx = x0 - x1;
  var dy = y0 - y1;
  return Math.sqrt((dx*dx)+(dy*dy));
}

// function pathFromVisited(visited, endId) {
//   var path = [endId];
//   var curId = endId;
//   var curIdx = _.findIndex(visited, function (v) {
//     return v.id === curId;
//   });
//   while(curIdx !== -1) {
//     var edge = visited.splice(curIdx, 1)[0];
//     curId = edge.previousEdge;
//     if (!curId) break;
//     path.push(curId);
//     curIdx = _.findIndex(visited, function (v) {
//       return v.id === curId;
//     });
//   }
//   return path;
// }

// set idx
// function enqueue(queue, edge, prevId) {
//   var sortFunc = function(edge) {
//     // inverted sort order - largest [....] smallest
//     return (1/edge.tCost);
//   };

//   // if the queue contains the edge already
//   // update the tCost if it is less than the
//   // current cost
//   var existingIdx = _.findIndex(queue, function(e) {
//     return e.id === edge.id;
//   });
//   if (existingIdx !== -1) { // if found
//     if (queue[existingIdx].tCost > edge.tCost) {
//       queue[existingIdx].tCost = edge.tCost;
//       queue[existingIdx].previousEdge = prevId;
//       _.sortBy(queue, sortFunc);
//     }
//     return;
//   }

//   var idx = _.sortedIndexBy(queue, edge, sortFunc);
//   // update the previous edge
//   edge.previousEdge = prevId;
//   // insert the in order or on top
//   if (idx === -1) {
//     queue.push(edge);
//   } else {
//     queue.splice(idx, 0, edge);
//   }
// }

// return idx
// function dequeue(queue) {
//   // return the smallest tCost
//   return queue.pop();
// }

// only return the edges of the unvisited neighbors
function getConnectedEdges(x, y, optStartId) {
  var idx0Start = _.sortedIndexBy(g_edgex0SortedDataset, {x0: x}, 'x0');
  var idx0End = _.sortedLastIndexBy(g_edgex0SortedDataset, {x0: x}, 'x0');

  var x0Indexes = [];
  for (var i = idx0Start; i <= idx0End; i++) {
    if (!g_edgex0SortedDataset[i]) {
      // end of the line
      // console.error("Invalid index");
    } else {
      if (g_edgex0SortedDataset[i].y0 === y) {
        if (g_edgex0SortedDataset[i].visited ||
            (optStartId && g_edgex0SortedDataset[i].id === optStartId));
        else
          x0Indexes.push(i);
      }
    }
  }

  var idx1Start = _.sortedIndexBy(g_edgex1SortedDataset, {x1: x}, 'x1');
  var idx1End = _.sortedLastIndexBy(g_edgex1SortedDataset, {x1: x}, 'x1');

  var x1Indexes = [];
  for (var i = idx1Start; i <= idx1End; i++) {
    if (!g_edgex1SortedDataset[i]) {
      // end of the line
      // console.error("Invalid index");
    } else {
    if (g_edgex1SortedDataset[i].y1 === y) {
        if (g_edgex1SortedDataset[i].visited ||
          (optStartId && g_edgex1SortedDataset[i].id === optStartId));
        else
          x1Indexes.push(i);
      }
    }
  }

  return {
    oSortedIndexes: x0Indexes,
    dSortedIndexes: x1Indexes
  };
}

function clearPaths() {
  _.forEach(g_pathIds, function(id) {
    var selected = d3.select(`#${id}`);
    selected.style('stroke', 'black');
  });
}

// single point implementation
// ({x,y,tc, path:[id1,id2,id3...]})
function shortestPath(point) {
  // get closest links
  // visit each closest line if the total cost is less than the current cost
  // update the path to the current node
  var linkedIdxs = getConnectedEdges(point.x, point.y);
  var nextPts = [];

  _.each(linkedIdxs.oSortedIndexes, function (idx) {
    // var edge = g_edgex0SortedDataset[idx];
    var newCost = point.tc + g_edgex0SortedDataset[idx].cost;
    var newPath = _.concat(point.path, [g_edgex0SortedDataset[idx].id]); //[getEdgeId(edge)]);
    var old = g_edgex0SortedDataset[idx].tCost;
    if (old && old < newCost); // do nothing
    else {
      g_edgex0SortedDataset[idx].tCost = newCost;
      // g_edgex0SortedDataset[idx].path = point.path;
      g_edgex0SortedDataset[idx].path = newPath;
      nextPts.push({x: g_edgex0SortedDataset[idx].x1,
        y: g_edgex0SortedDataset[idx].y1,
        tc: newCost,
        path: newPath});
    }
  });

  _.each(linkedIdxs.dSortedIndexes, function (idx) {
    // var edge = g_edgex1SortedDataset[idx];
    var newCost = point.tc + g_edgex1SortedDataset[idx].cost;
    var newPath = _.concat(point.path, [g_edgex1SortedDataset[idx].id]);
    var old = g_edgex1SortedDataset[idx].tCost;
    if (old && old < newCost); // do nothing
    else {
      g_edgex1SortedDataset[idx].tCost = newCost;
      // g_edgex1SortedDataset[idx].path = point.path;
      g_edgex1SortedDataset[idx].path = newPath;
      nextPts.push({x: g_edgex1SortedDataset[idx].x0,
        y: g_edgex1SortedDataset[idx].y0,
        tc: newCost,
        path: newPath});
    }
  });

  nextPts = _.sortBy(nextPts, "tc");
  // visit the next points by distance
  _.each(nextPts, function(pt) {
    shortestPath(pt);
  });
}

function highlightPath(path, color) {
  _.each(path, function (pId) {
    var selected = d3.select(`#${pId}`);
    selected.style('stroke', color)
    selected.style("stroke-width", 10)
    ;

    g_currentHighlightedPaths.push(pId);
  });
}

function unHighlightPaths() {
  _.each(g_currentHighlightedPaths, function (pId) {
    var selected = d3.select(`#${pId}`);
    selected.style('stroke', 'black')
    selected.style("stroke-width", 4)
    ;

  });
}

function onNodeHighlight(pt) {
  var linkedIdxs = getConnectedEdges(pt.x, pt.y);
  var paths = [];
  _.each(linkedIdxs.oSortedIndexes, function (idx) {
    var edge = g_edgex0SortedDataset[idx];
    if (!edge.tCost || !edge.path)
      console.log("No path information available");
    else
      paths.push({route: edge.path, cost: edge.tCost});
  });

  _.each(linkedIdxs.dSortedIndexes, function (idx) {
    var edge = g_edgex1SortedDataset[idx];
    if (!edge.tCost || !edge.path)
     console.log("No path information available");
    else
      paths.push({route: edge.path, cost: edge.tCost});
  });

  paths = _.sortBy(paths, 'cost');
  // TODO perhaps highlight the second or third routes
  if (paths.length > 0)
    highlightPath(paths[0].route, "blue");

  // for (var i = 0; i < paths.length; i++){
  //   if (i === 0) {
  //     highlightPath(paths[i].route, "blue");
  //   }
  //   highlightPath(paths[i].route, "gray");
  // }
}

// function onBeginPathAlgorithm() {
//   var t0 = performance.now();
//   clearPaths();
//   g_pathIds = [];
//   g_vertexIds = [];
//   if (!(g_pathStartElem.value && g_pathEndElem.value)) {
//     // console.error("Please select a path start and finish");
//     return;
//   }

//   var start = {
//     x: g_pathStartElem.value.x,
//     y: g_pathStartElem.value.y
//   };

//   var destX = g_pathEndElem.value.x;
//   var destY = g_pathEndElem.value.y;

//   queue = [];
//   // var visited = [];
//   // var dataset = [...g_edgeDataset];
//   var dataset = [];
//   _.forEach(g_allEdges, function (e) {
//     if (!e.origin.point || !e.dest.point) throw "invalid edge detected";
//     var obj = {
//       x0: e.origin.point[0],
//       x1: e.dest.point[0],
//       y0: e.origin.point[1],
//       y1: e.dest.point[1],
//       id: getEdgeId(e),
//       cost: distance(e),
//       tCost: undefined,
//       previousEdge: undefined
//     };
//     dataset.push(obj);
//   });

//   // perhaps this can be done pre-processing?
//   g_edgex0SortedDataset = _.sortBy(dataset, 'x0');
//   g_edgex1SortedDataset = _.sortBy(dataset, 'x1');

//   // initialize the start edge
//   var indexes = getConnectedEdges(start.x, start.y);

//   _.forEach(indexes.oSortedIndexes, function (idx) {
//     g_edgex0SortedDataset[idx].endX = g_edgex0SortedDataset[idx].x1;
//     g_edgex0SortedDataset[idx].endY = g_edgex0SortedDataset[idx].y1;
//     g_edgex0SortedDataset[idx].tCost = g_edgex0SortedDataset[idx].cost;
//     enqueue(queue,  g_edgex0SortedDataset[idx], undefined);
//   });

//   _.forEach(indexes.dSortedIndexes, function (idx) {
//     g_edgex1SortedDataset[idx].endX = g_edgex1SortedDataset[idx].x0;
//     g_edgex1SortedDataset[idx].endY = g_edgex1SortedDataset[idx].y0;
//     g_edgex1SortedDataset[idx].tCost = g_edgex1SortedDataset[idx].cost;
//     enqueue(queue,  g_edgex1SortedDataset[idx], undefined);
//   });

//   var curEdge = dequeue(queue);
//   curEdge.visited = true;

//   while (curEdge.endX !== destX && curEdge.endY !== destY) {

//     var endX = curEdge.endX;
//     var endY = curEdge.endY;
//     var curId = curEdge.id;

//     var indexes = getConnectedEdges(endX, endY, curId);
//     // evaluate connected neighbors and update the tCost
//     // set the previous vertex
//     _.forEach(indexes.oSortedIndexes, function (idx) {
//       g_edgex0SortedDataset[idx].endX = g_edgex0SortedDataset[idx].x1;
//       g_edgex0SortedDataset[idx].endY = g_edgex0SortedDataset[idx].y1;
//       g_edgex0SortedDataset[idx].tCost = curEdge.tCost + g_edgex0SortedDataset[idx].cost;
//       enqueue(queue,  g_edgex0SortedDataset[idx], curId);
//     });
//     _.forEach(indexes.dSortedIndexes, function (idx) {
//       g_edgex1SortedDataset[idx].endX = g_edgex1SortedDataset[idx].x0;
//       g_edgex1SortedDataset[idx].endY = g_edgex1SortedDataset[idx].y0;
//       g_edgex1SortedDataset[idx].tCost = curEdge.tCost + g_edgex1SortedDataset[idx].cost;
//       enqueue(queue,  g_edgex1SortedDataset[idx], curId);
//     });
//     // Visit the unvisited vertex with the smallest tCost
//     var nextEdge = dequeue(queue);

//     if (!nextEdge) {
//       console.error("Invalid EDGE");
//     }
//     // keep trying to visit new neighbors until we've
//     // reached one we haven't visited
//     while(nextEdge.visited) {
//       nextEdge = dequeue(queue);
//       if (!nextEdge) {
//         console.error("Invalid EDGE");
//       }
//     }
//     nextEdge.visited = true;
//     curEdge = nextEdge;
//   }

//   var allVisited = _.filter(dataset, function(elem) {
//     return elem.visited;
//   });

//   // testing only - show all paths visited
//   // _.forEach(allVisited, function(edge) {
//   //   var selected = d3.select(`#${edge.id}`);
//   //   selected.style('stroke', highlightColor);
//   // });


//   g_pathIds = pathFromVisited(allVisited, curEdge.id);
//   _.forEach(g_pathIds, function(id) {
//     var selected = d3.select(`#${id}`);
//     selected.style('stroke', highlightColor);
//   });

//   var t1 = performance.now();
//   var processTime = t1 - t0;
//   console.log("Path Processing Time:" + processTime.toFixed(6) + "(ms)");
// }
