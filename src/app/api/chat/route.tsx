import { NextRequest } from 'next/server';
import { OpenAI } from 'openai';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { model, messages, stream, provider } = body;

  if (!model || !messages || !Array.isArray(messages) || !provider) {
    return new Response(JSON.stringify({ error: 'Invalid request body: model, messages, and provider are required' }), {
      status: 400,
    });
  }

  try {
    if (provider === 'openai') {
      const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
      if (!apiKey) {
        return new Response(JSON.stringify({ error: 'Missing OpenAI API key' }), { status: 500 });
      }

      const openai = new OpenAI({ apiKey });

      const streamResponse = await openai.chat.completions.create({
        model,
        messages,
        stream: true,
      });

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          for await (const chunk of streamResponse) {
            if (chunk.choices[0]?.delta?.content) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ choices: [{ delta: { content: chunk.choices[0].delta.content } }] })}\n\n`
                )
              );
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    } else if (provider === 'ollama') {
      const ollamaHost = process.env.NEXT_PUBLIC_OLLAMA_HOST;
      if (!ollamaHost) {
        return new Response(JSON.stringify({ error: 'Missing Ollama host configuration' }), { status: 500 });
      }

      const response = await fetch(`${ollamaHost}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, stream }),
      });

      if (!response.ok) {
        return new Response(JSON.stringify({ error: `Ollama error: ${response.status} ${response.statusText}` }), {
          status: 503,
        });
      }

      return new Response(response.body, {
        headers: {
          'Content-Type': 'text-event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    } else {
      return new Response(JSON.stringify({ error: `Invalid provider: ${provider}` }), { status: 400 });
    }
  } catch (error: any) {
    console.error('API error:', error);
    const errorMessage = error.message || 'Internal server error';
    if (error.message?.includes('Ollama')) {
      return new Response(JSON.stringify({ error: `Ollama service unavailable: ${errorMessage}` }), { status: 503 });
    } else if (error.code === 'invalid_api_key') {
      return new Response(JSON.stringify({ error: 'Invalid OpenAI API key' }), { status: 401 });
    } else if (error.code === 'model_not_found') {
      return new Response(JSON.stringify({ error: `Model not found: ${model}` }), { status: 404 });
    } else {
      return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
    }
  }
}