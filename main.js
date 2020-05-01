"use strict";

var g_sweepline = {x1: -1, x2:1, y: -1};
var g_eventThresh = 1e-6;

let g_queue = {};

let g_vertexProcessing = 0;
let g_addTime = 0;

let g_setIdx = 0;

let g_datasetList = [
  {label:"Maze Dataset", sanitize: true, filePath: "./data/maze/files.txt"},
  {label:"100 Random Lines", num:100, filePath: "./data/random_100/files.txt"},
  {label:"500 Random Lines", num:500, filePath: "./data/random_500/files.txt"},
  {label:"1000 Random Lines", num:1000, filePath: "./data/random_1000/files.txt"},
  {label:"Sydney city dataset", sanitize: true, isMap: true, filePath:"./data/maps/Sydney_2_512.map"},
  {label:"Berlin city dataset", sanitize: true, isMap: true, filePath:"./data/maps/Berlin_0_256.map"},
  {label:"Boston city dataset", sanitize: true, isMap: true, filePath:"./data/maps/Boston_0_256.map"},
  {label:"Moscow city dataset", sanitize: true, isMap: true, filePath:"./data/maps/Moscow_1_256.map"},

  // TODO updates
  // {label:"Denver city dataset", isMap: true, filePath:"./data/maps/Denver_0_256.map"},
  // {label:"Milan city dataset", isMap: true, filePath:"./data/maps/Milan_0_256.map"},
  // {label:"NewYork city dataset", isMap: true, filePath:"./data/maps/NewYork_1_256.map"},
  // {label:"Paris city dataset", isMap: true, filePath:"./data/maps/Paris_0_256.map"},
  // {label:"Shanghai city dataset", isMap: true, filePath:"./data/maps/Shanghai_2_256.map"},
  {label:"Holes-64", sanitize: true, filePath: "./data/holes/h_64/files.txt"},
  {label:"Holes-128", sanitize: true, filePath: "./data/holes/h_128/files.txt"},
  {label:"Holes-256", sanitize: true, filePath: "./data/holes/h_256/files.txt"},
  {label:"Holes-512", sanitize: true, filePath: "./data/holes/h_512/files.txt"},
  {label:"Holes-1024", sanitize: true, filePath: "./data/holes/h_1024/files.txt"},
  {label:"Holes-2048", sanitize: true, filePath: "./data/holes/h_2048/files.txt"},
  {label:"Holes-4096", sanitize: true, filePath: "./data/holes/h_4096/files.txt"},
  {label:"Holes-8192", sanitize: true, filePath: "./data/holes/h_8192/files.txt"},
  {label:"Holes-16384", sanitize: true, filePath: "./data/holes/h_16384/files.txt"},
  {label:"Holes-32768", sanitize: true, filePath: "./data/holes/h_32768/files.txt"},
  {label:"RPG 64", filePath: "./data/rpg_64/files.txt"},
  {label:"RPG 128", filePath: "./data/rpg_128/files.txt"},
  {label:"RPG 256", filePath: "./data/rpg_256/files.txt"},
  {label:"RPG 512", filePath: "./data/rpg_512/files.txt"},
  {label:"RPG 1024", filePath: "./data/rpg_1024/files.txt"},
  {label:"RPG 2048", filePath: "./data/rpg_2048/files.txt"},
  {label:"RPG 4096", filePath: "./data/rpg_4096/files.txt"},
  {label:"RPG 8192", filePath: "./data/rpg_8192/files.txt"},
  {label:"RPG 16384", filePath: "./data/rpg_16384/files.txt"},
  {label:"GVD++ Results", cppRslts: true,
    pPath: "./data/gvd++/output_polygons.txt",
    ePath: "./data/gvd++/output_edges.txt",
    bPath: "./data/gvd++/output_beachline.txt",
    cPath: "./data/gvd++/output_close.txt",
    sPath: "./data/gvd++/output_sweepline.txt"
  },
  // {label:"RPG 32768", filePath: "./data/rpg_32768/files.txt"},
  {label:"Data Testing", filePath: "./data/test/files.txt"}
 ];

let closeEventPoints = [];
let dcel;

// Debug options
let g_debugObjs = [];
let g_addDebug = false;
let g_debugIdLeft = undefined;
let g_debugIdMiddle = undefined;
let g_debugIdRight = undefined;

let g_sInc = 0.01;
let g_xInc = 0.001;

let g_settings = {
  // Enable_C: {label: "Enable C++", value: false},
  showEvents: {label: "Show Events", value: true},
  showSweepline: {label: "Show Sweepline", value: true},
  showGVDVer: {label: "Show GVD vertices", value: true},
  showGVDSeg: {label: "Show GVD segments", value: true},
  showObjVer: {label: "Show object vertices", value: true},
  showObjSeg: {label: "Show object segments", value: true},
  showMedial: {label: "Show Medial Axis", value: false},
  showDebugObjs: {label: "Show Debug Input", value: false}, // debugging only
  showTree: {label: "Show Tree", value: false},
  showBeachLine: {label: "Show beachline", value: true},
  showOverview: {label: "Show Overview", value: false}
};

let g_treeId = "#treeTagId";

// debugging only
function updateDebugVars() {
  var p = document.getElementsByName("xIncVal")[0].valueAsNumber;
  g_xInc = _.isNaN(p) ? g_xInc : p;
  var i = document.getElementsByName("incVal")[0].valueAsNumber;
  g_sInc = _.isNaN(i) ? g_sInc : i;

  g_debugIdLeft = document.getElementsByName("leftId")[0].valueAsNumber;
  localStorage.g_debugIdLeft = g_debugIdLeft;
  g_debugIdMiddle = document.getElementsByName("middleId")[0].valueAsNumber;
  localStorage.g_debugIdMiddle = g_debugIdMiddle;
  g_debugIdRight = document.getElementsByName("rightId")[0].valueAsNumber;
  localStorage.g_debugIdRight = g_debugIdRight;
}

function setSweepline(d) {
  g_sweepline.y = d;
  localStorage.sweepline = d;
}

function incSweepline(inc) {
  g_sweepline.y += inc;
  setSweepline(g_sweepline.y);
}

function updateSweepline() {
  var elem = document.getElementById("sweeplineInput");
  moveSweepline(parseFloat(elem.value));
}

// template to call the server
// function callServer() {
//   var query = '/holes';
//   $.get(query)
// }

function keydown(event) {
  var x = event.keyCode;
  var key = event.key;
  var changed = false;
  var inc = 0.01;
  if (x == 40 || key == "j" || key == "J") {
    // Down arrow
    if (event.shiftKey) {
      incSweepline(-inc * g_sInc);
    } else if (event.ctrlKey) {
      incSweepline(-inc * 10);
    } else {
      incSweepline(-inc);
    }
    changed = true;
  } else if (x == 38 || key == "k" || key == "K") {
    // Up arrow
    if (event.shiftKey) {
      incSweepline(inc * g_sInc);
    } else if (event.ctrlKey) {
      incSweepline(inc * 10);
    } else {
      incSweepline(inc);
    }
    changed = true;
  }
  if (changed) {
    // Prevent scroll
    event.preventDefault();
    document.getElementById("sweeplineInput").value = g_sweepline.y.toFixed(10);

    if (g_settings.Enable_C && g_settings.Enable_C.value)
      sweeplineUpdate_C_addon(localStorage.setIdx);
    else
      render();
  }
}

function init() {
  var s = getLocalSettings();
  if (s)
    g_settings = s;

  setExampleDataset();
  if (localStorage.sweepline && !_.isNaN(localStorage.sweepline)
  && localStorage.sweepline !== "NaN") {
    g_sweepline.y = parseFloat(localStorage.sweepline);
  }

  // debugging only
  document.getElementsByName("xIncVal")[0].valueAsNumber = g_xInc;
  document.getElementsByName("incVal")[0].valueAsNumber = g_sInc;

  drawInit(g_sweepline, g_settings);

  document.onkeydown = keydown;
  document.getElementById("sweeplineInput").value = g_sweepline.y.toFixed(10);

  _.forEach(g_datasetList, function (p) {
    var option = document.createElement("option");
    option.text = p.label;
    document.getElementById("dataset-select").add(option);
  });

  if (localStorage.setIdx) {
    g_setIdx = parseInt(localStorage.setIdx);
  }
  document.getElementById("dataset-select").selectedIndex = g_setIdx;
  if (g_settings.Enable_C && g_settings.Enable_C.value)
    datasetChange_C_addon(g_setIdx);
  else
    datasetChange(g_setIdx);
}

// function datasetChange_C_addon(idx) {
//   g_datasetList[idx].c_init = true;
//   localStorage.setIdx = idx;
//   var query = '/gvd_cpp/?value=' + g_datasetList[idx].filePath + "&sweepline=" + g_sweepline.y.toFixed(10);
//   $.get(query).then(function (json) {
//     if (json.err && json.err.length > 0) {
//       console.error("Server error: " + json.err);
//       return;
//     }

//     if (json.msg && json.msg.length > 0) {
//       console.log("Server message: " + json.msg);
//     }

//     var sites = JSON.parse(json.sites);
//     var edges = JSON.parse(json.edges);
//     var beachline = JSON.parse(json.beachline);
//     var closeEvents = JSON.parse(json.closeEvents);

//     renderData(sites, edges, beachline, closeEvents);
//   });
// }

// function sweeplineUpdate_C_addon(idx) {
//   if (!g_datasetList[idx].c_init){
//     datasetChange_C_addon(idx);
//     return;
//   }

//   localStorage.setIdx = idx;
//   drawSweepline(g_sweepline);
//   var query = '/gvd_cpp_inc/?value=' + g_datasetList[idx].filePath + "&sweepline=" + g_sweepline.y.toFixed(10);
//   $.get(query).then(function (json) {
//     if (json.err && json.err.length > 0) {
//       console.error("Server error: " + json.err);
//       return;
//     }

//     if (json.msg && json.msg.length > 0) {
//       console.log("Server message: " + json.msg);
//     }
//     var edges = JSON.parse(json.edges);
//     var beachline = JSON.parse(json.beachline);
//     var closeEvents = JSON.parse(json.closeEvents);
//     renderData([], edges, beachline, closeEvents);
//     enforceSettings();
//   });
// }

function datasetChange(idx) {
  g_setIdx = idx;

  if (g_datasetList[g_setIdx].cppRslts) {
    localStorage.setIdx = g_setIdx;
    renderData();
    return;
  }

  if (!g_datasetList[g_setIdx].data) {
    processNewDataset();
  } else {
    var segments = [];
    var points = [];
    g_datasetList[g_setIdx].data.forEach(function(poly) {
      segments = segments.concat(poly.segments);
      points = points.concat(poly.points);
    });

    drawSites(points);
    drawSegments(segments);

    render();
    updateOverview();
  }

  localStorage.setIdx = g_setIdx;
}

function fortune(reorder) {
  nodeId = 1;
  var queue = createDataQueue(reorder);
  dcel = new DCEL();
  var beachline = new Beachline(dcel);
  closeEventPoints = [];
  if (queue.length < 1) return beachline;
  var nextY = getEventY(queue[queue.length - 1]);

  g_addTime = 0;
  g_vertexProcessing = 0;
  while (queue.length > 0 && nextY > g_sweepline.y) {
    var event = queue.pop();
    if (event.isCloseEvent) {
      if (event.live && event.arcNode.closeEvent.live) {

        // only set if not overridden // TODO Performance
        var prevEdge = event.arcNode.prevEdge();
        var nextEdge = event.arcNode.nextEdge();

        var endingEdges = [];
        if (!prevEdge.dcelEdge.dest.overridden && !neighborSites(prevEdge)) {
          endingEdges.push(prevEdge.dcelEdge);
        }
        if (!nextEdge.dcelEdge.dest.overridden && !neighborSites(nextEdge)) {
          endingEdges.push(nextEdge.dcelEdge);
        }

        var curY = getEventY(event);
        var newEvents = beachline.remove(event.arcNode, event.point, curY, endingEdges);
        newEvents.forEach(function (ev) {
            var newY = getEventY(ev);
            if (newY < curY - g_eventThresh || Math.abs(newY - curY) < g_eventThresh) {
            sortedInsertion(queue, ev);
            if (ev.isCloseEvent) {
              closeEventPoints.push(ev);
            }
          }
        });
      }
    } else {
      // Site event
      var packet = getEventPacket(event, queue);
      var newEvents = beachline.add(packet);
      var curY = getEventY(event);
      newEvents.forEach(function (ev) {
        var newY = getEventY(ev);
        if (newY < curY - g_eventThresh || Math.abs(newY - curY) < g_eventThresh) {
          sortedInsertion(queue, ev);
          if (ev.isCloseEvent) {
            closeEventPoints.push(ev);
          }
        }
      });
    }
    if (queue.length > 0)
      nextY = getEventY(queue[queue.length - 1]);
  }

  // Processing metrics
  // console.log("Time in loop:" + loopTime.toFixed(6) + "(ms)");
  console.log("Time adding:" + g_addTime.toFixed(6) + "(ms)");
  console.log("Time closing:" + g_vertexProcessing.toFixed(6) + "(ms)");

  // debugging only
  // var ev = '';
  // while (queue.length > 0) {
  //   var e = queue.pop();
  //   var yval = e.type === "segment" ? e[0][1] : e[1];
  //   var at = "(y)@:" + yval + " ";
  //   var data;
  //   if (e.type == "segment") {
  //     data = at + 'a(' + e[0][0] + ',' + e[0][1] + ') - b(' + e[1][0] + ',' + e[1][1] + ')';
  //   } else if (e.isCloseEvent) {
  //     var live = e.live && e.arcNode.closeEvent.live ? "(Live)" : "(Dead)";
  //     data = at + 'Close:' + e.id + " " + live + ' -point(' + e.point[0] + ',' + e.point[1] + ')';
  //   } else {
  //     data = at + 'point(' + e[0] + ',' + yval + ')';
  //   }
  //   if (e.isCloseEvent) {
  //     ev += data;
  //   } else {
  //     ev += data;
  //     // ev += data + ' r: ' + e.relation;
  //   }
  //   ev += '\n';
  // }
  // document.getElementById("events").innerHTML = ev;
  return beachline;
}

function moveSweepline(y) {
  setSweepline(y);
  if (g_settings.Enable_C && g_settings.Enable_C.value)
  sweeplineUpdate_C_addon(localStorage.setIdx);
  else
    render();
}

function render(reorder = false) {
  clearSurface();
  g_debugObjs = [];
  var t0 = performance.now();
  var beachline = fortune(reorder);
  var t1 = performance.now();
  var processTime = t1 - t0;
  console.log("Process Time:" + processTime.toFixed(6) + "(ms)");

  var t2 = performance.now();
  drawBeachline(beachline, g_sweepline.y);
  drawCloseEvents(closeEventPoints);
  drawSweepline(g_sweepline);
  drawSurface(dcel);
  var t3 = performance.now();
  var drawTime = t3 - t2;
  console.log("Draw Time:" + drawTime.toFixed(6) + "(ms)");

  if (g_settings.showTree.value){
    showTree(beachline.root);
  }

  enforceSettings();
  // runTests();
}
