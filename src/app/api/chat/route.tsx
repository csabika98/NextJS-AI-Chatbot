import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { model, messages, stream, provider } = await req.json();
    console.log(`API Received: provider=${provider}, model=${model}, messages=`, messages);

    if (provider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: 'Missing OpenAI API key' }, { status: 500 });
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          stream,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return NextResponse.json({ error: errorData.error || 'OpenAI API error' }, { status: response.status });
      }

      if (stream) {
        return new NextResponse(response.body, {
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }

      const data = await response.json();
      return NextResponse.json(data);
    } else if (provider === 'ollama') {
      const ollamaHost = process.env.NEXT_PUBLIC_OLLAMA_HOST;
      if (!ollamaHost) {
        return NextResponse.json({ error: 'Missing Ollama host configuration' }, { status: 500 });
      }

      console.log(`Calling Ollama API at ${ollamaHost}/api/chat`);
      const response = await fetch(`${ollamaHost}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return NextResponse.json({ error: errorData.error || 'Ollama API error' }, { status: response.status });
      }

      if (stream) {
        console.log(`Streaming Ollama response`);
        return new NextResponse(response.body, {
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }

      const data = await response.json();
      return NextResponse.json(data);
    } else {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json({ error: (error as Error).message || 'Internal server error' }, { status: 500 });
  }
}