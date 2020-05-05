#include <string>
#include <iostream>
#include <fstream>
#include <chrono>

#include "fortune.hh"
#include "dataset.hh"
#include "math.hh"
#include "types.hh"
#include "utils.hh"

// usage:
// ./gvd++ /home/dmarsden/dev2/gvd-fortune/data/testing/files.txt 0.917
// ./gvd++ /home/dmarsden/dev2/gvd-fortune/data/random_100/files.txt 0.917
// ./gvd++ /home/dmarsden/dev2/gvd-fortune/data/testing/files.txt 0.917

// ./gvd++ /home/dmarsden/dev2/gvd-fortune/data/random_100/files.txt 0.945

/* TASK list
 - edges not complete
 - nodes not closing
*/


int main(int argc, char** argv)
{
  // always run from the /gvd-fortune/ folder
  // all paths must be relative to the gvd-fortune/ folder
  if (argc < 3)
  {
    std::cout << "Usage: <program> <input file containing a list of object paths> <sweep line y value>\n";
    return 0;
  }

  std::string inputFile(argv[1]);
  // perhaps this should be input on a loop while the program is running and data is parsed
  double sweepline = std::stod(std::string(argv[2]));
  // Read in the dataset files
  try
  {
    // testing only
    std::cout << "input file:" << inputFile << std::endl;
    // only wrap for testing
    auto polygons = processInputFiles(inputFile);
    auto queue = createDataQueue(polygons);
    std::string msg;
    std::string err;
    auto start = std::chrono::system_clock::now();
    auto rslt = fortune(queue, sweepline, msg, err);
    auto end = std::chrono::system_clock::now();
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(end-start);
    std::cout << "Process Duration: " << ms.count() << "(ms)\n";

    std::cout << "Msg: " << msg << std::endl;
    std::cout << "Error: " << err << std::endl;

    // printTree();

    // write result to disk
    std::string pPath("../data/gvd++/output_polygons.txt");
    std::string ePath("../data/gvd++/output_edges.txt");
    std::string bPath("../data/gvd++/output_beachline.txt");
    std::string cPath("../data/gvd++/output_close.txt");

    rslt.polygons = polygons;
    writeResults(rslt, pPath, ePath, bPath, cPath);

    std::string sPath("../data/gvd++/output_sweepline.txt");
    std::fstream sl(sPath.c_str(), sl.binary | sl.out | sl.trunc);
    sl << sweepline;

    // testing only
    // std::cout << "printing test files\n";
    // std::vector<std::string> files;
    // int count = 0;
    // for (auto&& p : polygons)
    // {
    //   std::string filename = "file_" + std::to_string(count) + ".txt";
    //   std::ofstream ofs(std::string("./gvd2.0/test_output/" + filename).c_str(), std::ofstream::out | std::ios_base::trunc);
    //   auto sites = p.getPointSites();
    //   std::cout << "poly point size:" << sites.size() << std::endl;
    //   for (auto&& pS : sites)
    //   {
    //     ofs << pS->x() << " " << pS->y() << "\n";
    //   }
    //   // wrap
    //   ofs << sites[0]->x() << " " << sites[0]->y() << "\n";

    //   files.push_back("./gvd2.0/test_output/" + filename);
    //   count++;
    //   ofs.close();
    // }

    // std::ofstream ofs2("./gvd2.0/test_output/_files.txt" , std::ofstream::out | std::ios_base::trunc);
    // for (auto&& f : files)
    // {
    //   ofs2 << f << "\n";
    // }

    // ofs2.close();

    // infinite loop to adjust the sweepline?
  }
  catch(const std::exception& e)
  {
    std::cout << e.what() << '\n';
  }
  catch(...)
  {
    std::cout << "Unknown error\n";
  }

  return 0;
}
