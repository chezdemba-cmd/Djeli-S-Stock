import { google } from '@ai-sdk/google';
import { streamText } from 'ai';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages, context } = await req.json();

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return new Response(JSON.stringify({ error: "Clé API Google non configurée." }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const systemPrompt = `
Tu es Comy IA, l'assistant financier et commercial intelligent intégré à l'application Comy Stock.
Ton rôle est d'aider le gérant de la boutique à analyser ses ventes, son stock et sa trésorerie.
Sois concis, professionnel mais chaleureux, et utilise des emojis.

Voici les données actuelles de la boutique du gérant (agrégées) :
${JSON.stringify(context, null, 2)}

Réponds toujours en français.
    `;

    const result = await streamText({
      model: google('gemini-1.5-flash'),
      system: systemPrompt,
      messages,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Erreur API Chat:", error);
    return new Response(JSON.stringify({ error: "Une erreur s'est produite lors de la communication avec l'IA." }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
