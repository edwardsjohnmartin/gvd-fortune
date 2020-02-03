#include "types.hh"


SegmentSite makeSegment(vec2 p1, vec2 p2, uint32_t label, bool forceOrder)
{
  // check for p1.y == p2.y?
  // TESTING ONLY
  if (p1.y == p2.y)
    throw std::runtime_error("Horizontal segment detected");

  if (forceOrder)
  {
    return SegmentSite(label, p1, p2);
  }
  return p1.y > p2.y ? SegmentSite(label, p1, p2) : SegmentSite(label, p2, p1);
}
