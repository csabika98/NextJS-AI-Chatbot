import { NextRequest, NextResponse } from 'next/server';

interface RatingData {
  message_index: number;
  rating: 'thumbs-up' | 'thumbs-down';
  provider: 'ollama' | 'openai';
  ipAddress: string;
  timestamp: string;
}

interface RequestBody {
  message_index: number;
  rating: string;
  provider: string;
}

const ratings: RatingData[] = [];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as RequestBody;
    const { message_index, rating, provider } = body;

    if (!Number.isInteger(message_index) || !rating || !['thumbs-up', 'thumbs-down'].includes(rating) || !['ollama', 'openai'].includes(provider)) {
      return NextResponse.json({ error: 'Invalid rating data' }, { status: 400 });
    }

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    const ratingData: RatingData = {
      message_index,
      rating: rating as 'thumbs-up' | 'thumbs-down',
      provider: provider as 'ollama' | 'openai',
      ipAddress,
      timestamp: new Date().toISOString(),
    };

    ratings.push(ratingData);

    console.log('Received rating:', ratingData);

    return NextResponse.json({ message: 'Rating received successfully', rating: ratingData }, { status: 200 });
  } catch (error: unknown) {
    console.error('Error processing rating:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function GET() {
  try {
    return NextResponse.json({ ratings, total: ratings.length }, { status: 200 });
  } catch (error: unknown) {
    console.error('Error retrieving ratings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}