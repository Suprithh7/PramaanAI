import { GEMINI_API_KEY } from "./key-helper.mjs";

async function testAll() {
  const model = "gemini-3-flash-preview";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  
  const prompt = {
    contents: [
      {
        parts: [
          {
            text: `You are AICTE PramaanAI's Chief Scrutiny AI. 
Evaluate this institution for EoA (Extension of Approval):
Institution: Delhi Technological Institute
Sanctioned Intake: 1,200 students
Faculty on Record: 63
Built-up Area: 13,200 sq m
Land: 14 acres (registered lease 34 years)
Fire NOC: Valid till 2027
Building Plan: Approved

Return JSON:
{
  "readinessScore": number,
  "riskLevel": "CLEAR" | "ATTENTION" | "MATERIAL",
  "facultyStudentRatio": string,
  "fsrCompliant": boolean,
  "deficiencyFindings": [string],
  "recommendedAction": string
}`
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prompt)
  });
  const data = await res.json();
  console.log("Gemini Structured Evaluation Output:");
  console.log(data.candidates?.[0]?.content?.parts?.[0]?.text);
}

testAll();
