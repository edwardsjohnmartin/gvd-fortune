
function readCppResults(pFile, eFile, bFile, cFile, sFile, dataCB)
{
  // trim file paths?
  var rslt = {};
  d3.text(pFile, (pData) => {
    var pLines = pData.split('\n');
    var polygons = [];
    var dataPoints = [];
    pLines.forEach(line => {
      if (line.length === 0);
      else if (line[0] === 'p') {
        if (dataPoints.length !== 0){
          polygons.push({points: dataPoints});
          dataPoints = [];
        }
      } else {
        var p = line.split(" ");
        if (p.length != 2)
          throw "Invalid input data line:" + line;
        var newElem = {x: parseFloat(p[0]), y: parseFloat(p[1])};
        dataPoints.push(newElem);
      }
    });
    rslt.polygons = polygons;

    d3.text(eFile, (eData) => {
      var pLines = eData.split('\n');
      var edges = [];
      var dataPoints = [];
      pLines.forEach(line => {
        if (line.length === 0);
        else if (line[0] === 'e') {
          if (dataPoints.length !== 0){
            edges.push({points: dataPoints});
            dataPoints = [];
          }
        } else {
          var p = line.split(" ");
          if (p.length != 2)
            throw "Invalid line data line:" + line;
          var newElem = {x: parseFloat(p[0]), y: parseFloat(p[1])};
          dataPoints.push(newElem);
        }
      });
      rslt.edges = edges;

      d3.text(bFile, (bData) => {
        var bLines = bData.split('\n');
        var beachline = [];
        var dataPoints = [];
        bLines.forEach(line => {
          if (line.length === 0);
          else if (line[0] === 'b') {
            if (dataPoints.length !== 0){
              beachline.push({points: dataPoints});
              dataPoints = [];
            }
          } else {
            var p = line.split(" ");
            if (p.length != 2)
              throw "Invalid line data line:" + line;
            var newElem = {x: parseFloat(p[0]), y: parseFloat(p[1])};
            dataPoints.push(newElem);
          }
        });
        rslt.beachline = beachline;

        d3.text(cFile, (cData) => {
          var closeEvents = [];
          var cLines = cData.split('\n');
          cLines.forEach(line => {
            var list = line.split(" ");
            if (list.length === 3){
              closeEvents.push({x: parseFloat(list[0]), y: parseFloat(list[1]), yval: parseFloat(list[2])});
            }
          });
          rslt.closeEvents = closeEvents;

          d3.text(sFile, (sData) => {
            g_sweepline.y = parseFloat(sData);
            localStorage.sweepline = g_sweepline.y;
            drawSweepline(g_sweepline);
            dataCB(rslt);
          }); // sfile
        }); // cfile
      }); // bfile
    }); // efile
  });// pfile
}
