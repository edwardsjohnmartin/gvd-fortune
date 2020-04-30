#include "dataset.hh"
#include "math.hh"
#include "types.hh"

#include <algorithm>
#include <fstream>
#include <iostream>
#include <memory>
#include <sstream>
#include <vector>

namespace
{

  struct SortableVec2
  {
    vec2 v;
    size_t idx;
  };

  struct vec2_less_than
  {
    inline bool operator() (const SortableVec2& struct1, const SortableVec2& struct2)
    {
      // Y major, x minor
      return (struct1.v.y < struct2.v.y || struct1.v.x < struct2.v.x);
    }
  };

  /////////////////////////// Helper Functions //////////////////////////////////////////

  std::vector<std::string> split(const std::string& s, char delimiter)
  {
    std::vector<std::string> tokens;
    std::string token;
    std::istringstream tokenStream(s);
    while (std::getline(tokenStream, token, delimiter))
    {
        tokens.push_back(token);
    }
    return tokens;
  }

  vec2 parseLineToVec2(std::string const& s)
  {
    auto t = split(s, ' ');
    return {std::stod(t[0]), std::stod(t[1])};
  }

  struct RemovedResult
  {
    bool removed;
    std::vector<vec2> points;
  };

  bool isColinear(vec2 const& p1,vec2 const& p2, vec2 const& p3, std::shared_ptr<decimal_t> pOptTolerance = nullptr)
  {
    auto v1 = vec2(p2.x - p1.x, p2.y - p1.y);
    auto v2 = vec2(p3.x - p1.x, p3.y - p1.y);
    auto c = math::crossProduct(v1, v2);
    if (pOptTolerance)
    {
      return std::abs(c) < *pOptTolerance;
    }

    return c == 0;
  }

  std::vector<size_t> getMatch(std::vector<vec2> const& dataPoints)
  {
    for (size_t i = 0; i < dataPoints.size(); i++)
    {
      size_t prevIdx = i == 0 ? dataPoints.size()-1 : i-1;
      if (math::equivD(dataPoints[i].y, dataPoints[prevIdx].y))
        return { prevIdx, i };
    }
    return {};
  }

  decimal_t getOffsetValue(std::vector<vec2> const& dataPoints, std::vector<size_t> const& match)
  {
    auto xDiff = std::abs(dataPoints[match[0]].x - dataPoints[match[0]].x);
    auto value = xDiff * 0.007;
    if (value == 0.0) {return 1e-6;}
    return value;
  }

  RemovedResult removeColinearPoints(std::vector<vec2> const& points, std::shared_ptr<decimal_t> pOptTolerance = nullptr)
  {
    bool didRemove = false;
    std::vector<size_t> toRemove;
    std::vector<vec2> afterRemove;

    for (size_t i = 0; i < points.size(); i++) {
      size_t start = i == 0 ? points.size()-1 : i-1;
      size_t c = (i+1)%points.size();
      auto p1 = points[start];
      auto p2 = points[i];
      auto p3 = points[c]; // 2,3,0
      if (isColinear(p1, p2, p3, pOptTolerance))
      {
        std::vector<SortableVec2> l{{p1, start}, {p2, i}, {p3, c}};
        std::sort(l.begin(), l.end(), vec2_less_than());
        toRemove.push_back(l[1].idx);
      }
    }

    if (toRemove.size() > 0) {
      for (size_t j = 0; j < points.size(); ++j)
      {
        if (std::find(toRemove.begin(), toRemove.end(), j) == toRemove.end())
        {
          // does not contain j
          afterRemove.push_back(points[j]);
        }
      }

      didRemove = true;
    }
    // place the ending back on
    // add the start/end point if it does not create a colinear line
    // if (isColinear(orderedPoints[orderedPoints.size()], finalPoint, orderedPoints[0]))
    //   orderedPoints.push_back(finalPoint);
    if (didRemove)
      return {didRemove, afterRemove};
    else
      return {didRemove, points};
  }

  std::vector<vec2> removeCAS(std::vector<vec2> points, std::shared_ptr<decimal_t> pOptTolerance = nullptr)
  {
    auto rslt = removeColinearPoints(points, pOptTolerance);
    while(rslt.removed)
    {
      rslt = removeColinearPoints(rslt.points, pOptTolerance);
    }
    return rslt.points;
  }
}

std::vector<vec2> sanitizeData(std::vector<vec2>& orderedPoints, std::shared_ptr<decimal_t> pOptTolerance = nullptr)
{
  if (orderedPoints.size() > 3)
  {
    orderedPoints = removeCAS(orderedPoints, pOptTolerance);
  }

  if (orderedPoints.size() < 2) return orderedPoints;
  auto match = getMatch(orderedPoints);
  while(match.size() > 0)
  {
    orderedPoints[match[0]].y -= getOffsetValue(orderedPoints, match);
    match = getMatch(orderedPoints);
  }
  return orderedPoints;
}

std::vector<Polygon> processInputFiles(std::string const& inputFiles)
{
  std::ifstream fin(inputFiles.c_str());

  // each file is a single polygon, line, or point
  std::vector<Polygon> polygons;
  std::string filePath;
  while(fin >> filePath)
  {
    // std::cout << "File path:" << filePath << std::endl;
    if (filePath.empty()) continue;
    // trim?
    // each file of format
    // xxxxx yyyyyyy - p1
    // xxxxx yyyyyyy...
    // xxxxx yyyyyyy - p1
    std::ifstream file(filePath.c_str());
    std::string line;
    std::vector<std::string> lines;
    while (std::getline(file, line))
    {
      lines.push_back(line);
    }
    Polygon poly;

    if (lines.size() == 2)
    {
      poly.addPoint(parseLineToVec2(lines[0]));
    }
    else
    {
      std::vector<vec2> uniquePoints;
      // skip the first line since it is the same as the last
      for (size_t i = 0; i < lines.size() - 1; ++i)
      {
        uniquePoints.push_back(parseLineToVec2(lines[i]));
      }

      // auto uPts = uniquePoints;
      auto uPts = sanitizeData(uniquePoints);

      // we assume point sets greater than 2 are a closed polygon
      if (uPts.size() > 2)
      {
        for (size_t i = 0; i < uPts.size(); ++i)
        {
          poly.addPoint(uPts[i]);
        }
      }
      else if (uPts.size() == 2 && !math::equiv2(uPts[0], uPts[1]))
      {
        poly.addPoint(uPts[0]);
        poly.addPoint(uPts[1]);
      }
      else if (uPts.size() == 1 || math::equiv2(uPts[0], uPts[1]))
      {
        poly.addPoint(uPts[0]);
      }
    }

    polygons.push_back(poly);
  }
  return polygons;
}

// std::vector<Polygon> getTestSet()
// {
//   std::vector<Polygon> rslt;

//   Polygon p1;
//   p1.addPoint(vec2(0.123456, 0.3234526));
//   rslt.push_back(p1);

//   Polygon p2;
//   p2.addPoint(vec2(-0.1234, 0.534562));
//   rslt.push_back(p2);

//   Polygon p3;
//   p3.addPoint(vec2(0.5635, -0.343262));
//   rslt.push_back(p3);

//   Polygon p4;
//   p4.addPoint(vec2(-0.2335, 0.6262));
//   rslt.push_back(p4);

//   return rslt;
// }
