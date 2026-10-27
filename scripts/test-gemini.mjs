async function check() {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyAaq6jGXbeN18DT0yS8zQTXrPNlVKw8mg4");
  const data = await res.json();
  const generateModels = (data.models || []).filter(m => m.supportedGenerationMethods?.includes("generateContent"));
  console.log("Generative Models:", generateModels.map(m => m.name));
}
check();
