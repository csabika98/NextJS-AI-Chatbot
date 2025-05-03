import { NextRequest, NextResponse } from 'next/server';

let ratings: any[] = [];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message_index, rating, provider } = body;

    if (!Number.isInteger(message_index) || !rating || !['thumbs-up', 'thumbs-down'].includes(rating) || !['ollama', 'openai'].includes(provider)) {
      return NextResponse.json({ error: 'Invalid rating data' }, { status: 400 });
    }

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    const ratingData = {
      message_index,
      rating,
      provider,
      ipAddress,
      timestamp: new Date().toISOString(),
    };

    ratings.push(ratingData);

    console.log('Received rating:', ratingData);

    return NextResponse.json({ message: 'Rating received successfully', rating: ratingData }, { status: 200 });
  } catch (error: any) {
    console.error('Error processing rating:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json({ ratings, total: ratings.length }, { status: 200 });
  } catch (error: any) {
    console.error('Error retrieving ratings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}