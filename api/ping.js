export default async function handler(req, res) {
  try {
    const mod = await import('./index.js');
    return res.status(200).json({
      status: 'success',
      type: typeof mod.default,
      env: {
        nodeVersion: process.version,
        hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
        hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
        hasFirebaseServiceAccount: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT),
        hasFirebaseProjectId: Boolean(process.env.FIREBASE_PROJECT_ID),
      }
    });
  } catch (err) {
    return res.status(200).json({
      status: 'error_importing_index',
      name: err?.name,
      message: err?.message,
      stack: err?.stack
    });
  }
}
