async function benchmark(name: string, url: string, concurrency = 50, durationSeconds = 5) {
  console.log(`\n======================================================`);
  console.log(`Starting Benchmark: ${name}`);
  console.log(`URL: ${url}`);
  console.log(`VUs (Concurrency): ${concurrency}`);
  console.log(`Duration: ${durationSeconds} seconds`);

  let totalRequests = 0;
  let successCount = 0;
  let failureCount = 0;
  let totalTime = 0;
  let minTime = Infinity;
  let maxTime = 0;

  // Warmup
  const warmupPromises = Array.from({ length: 10 }).map(() => fetch(url).catch(() => { }));
  await Promise.all(warmupPromises);

  const durationMs = durationSeconds * 1000;
  const start = performance.now();

  const worker = async () => {
    while (performance.now() - start < durationMs) {
      const reqStart = performance.now();
      try {
        const res = await fetch(url);
        // Important: eagerly consume body to close the connection properly
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await res.text();

        const reqTime = performance.now() - reqStart;

        totalTime += reqTime;
        if (reqTime < minTime) minTime = reqTime;
        if (reqTime > maxTime) maxTime = reqTime;
        successCount++;
      } catch (err) {
        failureCount++;
      }
      totalRequests++;
    }
  };

  const workers = Array.from({ length: concurrency }).map(() => worker());
  await Promise.all(workers);

  const elapsed = performance.now() - start;

  console.log(`--- Results for ${name} ---`);
  console.log(`Total Requests: ${totalRequests}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${failureCount}`);
  console.log(`Total Duration: ${elapsed.toFixed(2)}ms`);
  console.log(`Avg Latency (ms/req): ${(totalTime / successCount || 0).toFixed(2)}ms`);
  console.log(`Min Latency: ${minTime === Infinity ? 0 : minTime.toFixed(2)}ms`);
  console.log(`Max Latency: ${maxTime.toFixed(2)}ms`);
  console.log(`-> Requests/sec (Throughput): ${((successCount / elapsed) * 1000).toFixed(2)} req/s`);
}

async function runAll() {
  let userId = "";
  let storeId = "";

  try {
    const userRes = await fetch("http://localhost:3000/random-user");
    const user: any = await userRes.json();
    userId = user.id;

    const storeRes = await fetch("http://localhost:3000/random-store");
    const store: any = await storeRes.json();
    storeId = store.id;
  } catch (e) {
    console.error("Could not fetch random IDs. Make sure the server is running and seeded.");
    return;
  }

  const VUS = 50;
  const DURATION_SECS = 5;

  await benchmark("Simple Query (100 rows)", "http://localhost:3000/products", VUS, DURATION_SECS);
  await benchmark("Shallow Relations (Product + Store + Category)", "http://localhost:3000/products-with-details", VUS, DURATION_SECS);
  await benchmark("Deep Relations (User -> Orders -> Items -> Product -> Store)", `http://localhost:3000/users/${userId}/dashboard`, VUS, DURATION_SECS);
  await benchmark("Heavy Aggregation (Store -> Products -> Reviews)", `http://localhost:3000/stores/${storeId}/full`, VUS, DURATION_SECS);

  console.log("\nBenchmarks completed!");
}

runAll();
