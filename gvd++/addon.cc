// #include <iostream>
// #include <node.h>

// #include "dataset.hh"
// #include "fortune.hh"
// #include "utils.hh"

// // build with:
// // node-gyp configure build

// namespace
// {
//   std::string g_dataset;
//   std::vector<Event> g_queue;
//   // std::vector<std::string> getDatasets()
//   // {
//   //   return {"./data/maze/_files.txt",
//   //           "./data/random_100/_files.txt",
//   //           "./data/random_200/_files.txt",
//   //           "./data/random_500/_files.txt",
//   //           "./data/random_1000/_files.txt",
//   //           "./data/holes/h_64/_files.txt",
//   //           "./data/holes/h_128/_files.txt",
//   //           "./data/holes/h_256/_files.txt",
//   //           "./data/holes/h_512/_files.txt",
//   //           "./data/holes/h_1024/_files.txt",
//   //           "./data/holes/h_2048/_files.txt",
//   //           "./data/holes/h_4096/_files.txt",
//   //           "./data/holes/h_8192/_files.txt",
//   //           "./data/holes/h_16384/_files.txt",
//   //           "./data/holes/h_32768/_files.txt"};
//   //   // TODO
//   //   // {label:"Sydney city dataset", isMap: true, filename:"Sydney_2_512.map"}, // TODO add more versions
//   //   // {label:"Berlin city dataset", isMap: true, filename:"Berlin_0_256.map"},
//   //   // {label:"Boston city dataset", isMap: true, filename:"Boston_0_256.map"},
//   //   // {label:"Moscow city dataset", isMap: true, filename:"Moscow_1_256.map"},
//   //   // {label:"Denver city dataset", isMap: true, filename:"Denver_0_256.map"}, // TODO FIX
//   //   // {label:"Milan city dataset", isMap: true, filename:"Milan_0_256.map"}, // TODO FIX
//   //   // {label:"NewYork city dataset", isMap: true, filename:"NewYork_1_256.map"}, // TODO FIX
//   //   // {label:"Paris city dataset", isMap: true, filename:"Paris_0_256.map"}, // TODO FIX
//   //   // {label:"Shanghai city dataset", isMap: true, filename:"Shanghai_2_256.map"},
//   // }
// }

// void ComputeGVD(const v8::FunctionCallbackInfo<v8::Value>& args)
// {
//   v8::Isolate* isolate = args.GetIsolate();
//   std::string msg;
//   std::string err;
//   std::string pPath("./output_polygons.txt");
//   std::string ePath("./output_edges.txt");
//   std::string bPath("./output_beachline.txt");
//   std::string cPath("./output_close.txt");
//   try
//   {
//     if (args.Length() < 2)
//     {
//       std::cout << "Compute GVD arg count too low\n";
//       return;
//     }

//     char set[255];
//     args[0]->ToString()->WriteUtf8(&set[0], args[0]->ToString()->Utf8Length());
//     g_dataset.assign(&set[0], args[0]->ToString()->Utf8Length());

//     double sweepline = args[1]->ToNumber()->Value();

//     auto polygons = processInputFiles(g_dataset);
//     g_queue = createDataQueue(polygons);
//     auto tmp = g_queue;
//     std::string msg;
//     std::string err;
//     auto gvdResults = fortune(tmp, sweepline, msg, err);
//     gvdResults.polygons = polygons;

//     writeResults(gvdResults, pPath, ePath, bPath, cPath);
//   }
//   catch(const std::exception& e)
//   {
//     std::cout << "Error " << e.what() << '\n';
//     err += "Error: " + std::string(e.what());
//   }

//   v8::Handle<v8::Object> result = v8::Object::New(isolate);
//   result->Set(v8::String::NewFromUtf8(isolate, "sites"), v8::String::NewFromUtf8(isolate, pPath.c_str()));
//   result->Set(v8::String::NewFromUtf8(isolate, "edges"), v8::String::NewFromUtf8(isolate, ePath.c_str()));
//   result->Set(v8::String::NewFromUtf8(isolate, "beachline"), v8::String::NewFromUtf8(isolate, bPath.c_str()));
//   result->Set(v8::String::NewFromUtf8(isolate, "closeEvents"), v8::String::NewFromUtf8(isolate, cPath.c_str()));
//   result->Set(v8::String::NewFromUtf8(isolate, "msg"), v8::String::NewFromUtf8(isolate, msg.c_str()));
//   result->Set(v8::String::NewFromUtf8(isolate, "err"), v8::String::NewFromUtf8(isolate, err.c_str()));
//   args.GetReturnValue().Set(result);
// }

// void Update(const v8::FunctionCallbackInfo<v8::Value>& args)
// {
//   v8::Isolate* isolate = args.GetIsolate();
//   std::string msg;
//   std::string err;
//   std::string pPath("./output_polygons.txt");
//   std::string ePath("./output_edges.txt");
//   std::string bPath("./output_beachline.txt");
//   std::string cPath("./output_close.txt");
//   try
//   {
//     if (args.Length() < 1)
//     {
//       std::cout << "Compute GVD arg count too low\n";
//       return;
//     }

//     double sweepline = args[0]->ToNumber()->Value();
//     auto tmp = g_queue;
//     auto gvdResults = fortune(tmp, sweepline, msg, err);
//     // gvdResults.polygons = polygons;

//     writeResults(gvdResults, pPath, ePath, bPath, cPath);
//   }
//   catch(const std::exception& e)
//   {
//     std::cout << "Error " << e.what() << '\n';

//     err += "Error: " + std::string(e.what());
//   }
//   v8::Handle<v8::Object> result = v8::Object::New(isolate);
//   result->Set(v8::String::NewFromUtf8(isolate, "sites"), v8::String::NewFromUtf8(isolate, pPath.c_str()));
//   result->Set(v8::String::NewFromUtf8(isolate, "edges"), v8::String::NewFromUtf8(isolate, ePath.c_str()));
//   result->Set(v8::String::NewFromUtf8(isolate, "beachline"), v8::String::NewFromUtf8(isolate, bPath.c_str()));
//   result->Set(v8::String::NewFromUtf8(isolate, "closeEvents"), v8::String::NewFromUtf8(isolate, cPath.c_str()));
//   result->Set(v8::String::NewFromUtf8(isolate, "msg"), v8::String::NewFromUtf8(isolate, msg.c_str()));
//   result->Set(v8::String::NewFromUtf8(isolate, "err"), v8::String::NewFromUtf8(isolate, err.c_str()));
//   args.GetReturnValue().Set(result);
// }

// void Initalize(v8::Local<v8::Object> exports)
// {
//   NODE_SET_METHOD(exports, "ComputeGVD", ComputeGVD);
//   NODE_SET_METHOD(exports, "Update", Update);
// }

// NODE_MODULE(addon, Initalize)