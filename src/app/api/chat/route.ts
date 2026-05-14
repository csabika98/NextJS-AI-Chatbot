import { NextRequest } from 'next/server';
import { OpenAI } from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { Provider } from '@/app/utils/MessageManager';

interface RequestBody {
  model: string;
  messages: ChatCompletionMessageParam[];
  stream: boolean;
  provider: Provider;
}

export async function POST(req: NextRequest) {
  const body = await req.json() as RequestBody;
  const { model, messages, stream, provider } = body;

  if (!model || !messages || !Array.isArray(messages) || !['ollama', 'openai', 'deepseek'].includes(provider)) {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 });
  }

  try {
    if (provider === 'openai' || provider === 'deepseek') {
      const apiKey = provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.DEEPSEEK_API_KEY;
      const defaultModel =
        provider === 'openai'
          ? process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o-mini'
          : process.env.DEEPSEEK_DEFAULT_MODEL || 'deepseek-v4-flash';

      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: `Missing ${provider === 'openai' ? 'OPENAI_API_KEY' : 'DEEPSEEK_API_KEY'}` }),
          { status: 500 }
        );
      }

      const openai = new OpenAI({
        apiKey,
        baseURL: provider === 'deepseek' ? 'https://api.deepseek.com' : undefined,
      });
      const modelToUse = model || defaultModel;

      const streamResponse = await openai.chat.completions.create({
        model: modelToUse,
        messages,
        stream: true,
      });

      const encoder = new TextEncoder();
      const responseStream = new ReadableStream({
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

      return new Response(responseStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    } else {
      const OLLAMA_HOST = process.env.NEXT_PUBLIC_OLLAMA_HOST;
      const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, stream }),
      });

      if (!response.ok) {
        return new Response(JSON.stringify({ error: `Ollama error: ${response.status} ${response.statusText}` }), { status: 503 });
      }

      return new Response(response.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const errorCode = error instanceof Error && 'code' in error ? (error as { code: string }).code : undefined;

    if (errorMessage.includes('Ollama')) {
      return new Response(JSON.stringify({ error: `Ollama service unavailable: ${errorMessage}` }), { status: 503 });
    } else if (errorCode === 'invalid_api_key') {
      return new Response(JSON.stringify({ error: 'Invalid API key' }), { status: 401 });
    } else {
      return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
    }
  }
}
