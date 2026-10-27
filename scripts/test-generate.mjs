async function test() {
  const models = ["gemini-3-flash-preview", "gemini-3.1-flash-lite-preview"];
  for (const m of models) {
    const t0 = Date.now();
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=AIzaSyAaq6jGXbeN18DT0yS8zQTXrPNlVKw8mg4`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Explain in 1 sentence why AICTE scrutinizes land and faculty." }] }]
        }),
        signal: AbortSignal.timeout(10000)
      });
      const data = await res.json();
      if (data.candidates) {
        console.log(`[${Date.now()-t0}ms] MODEL ${m} SUCCESS:`, data.candidates[0].content.parts[0].text.trim());
      } else {
        console.log(`MODEL ${m} FAIL:`, data.error?.message);
      }
    } catch (e) {
      console.log(`MODEL ${m} ERROR:`, e.message);
    }
  }
}
test();
