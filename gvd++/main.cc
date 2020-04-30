#include <string>
#include <iostream>
#include <fstream>
#include <chrono>

#include "fortune.hh"
#include "dataset.hh"
#include "math.hh"
#include "types.hh"
#include "utils.hh"

int main(int argc, char** argv)
{
  // always run from the /gvd-fortune/ folder
  // all paths must be relative to the gvd-fortune/ folder
  if (argc < 3)
  {
    std::cout << "Usage: <program> <input file containing a list of object paths> <sweep line y value>\n";
    return 0;
  }

  std::string i(argv[1]);
  // TODO this should be input on a loop while the program is running and data is parsed
  double sweepline = std::stod(std::string(argv[2])); 
  // Read in the dataset files
  try
  {
    // only wrap for testing
    auto polygons = processInputFiles(i);
    auto start = std::chrono::system_clock::now();
    auto queue = createDataQueue(polygons);
    std::string msg;
    std::string err;
    auto rslt = fortune(queue, sweepline, msg, err);
    std::cout << "Msg: " << msg << std::endl;
    std::cout << "Error: " << err << std::endl;
    auto end = std::chrono::system_clock::now();
    std::chrono::duration<double> elapsedSeconds = end-start;
    std::cout << "Process Duration: " << elapsedSeconds.count() << "s\n";

    // TODO write result to disk

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
