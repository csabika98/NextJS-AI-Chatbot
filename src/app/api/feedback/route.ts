import { NextRequest, NextResponse } from 'next/server';

interface FeedbackData {
  message: string;
  question?: string | null;
  rating: 'thumbs-up' | 'thumbs-down';
  feedbackText?: string | null;
  operatingSystem?: string | null;
  ipAddress: string;
  timestamp: string;
}

interface RequestBody {
  message: string;
  question?: string;
  rating: string;
  feedbackText?: string;
  operatingSystem?: string;
}

const feedbacks: FeedbackData[] = [];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as RequestBody;
    const { message, question, rating, feedbackText, operatingSystem } = body;

    if (!message || !rating || !['thumbs-up', 'thumbs-down'].includes(rating)) {
      return NextResponse.json({ error: 'Invalid feedback data' }, { status: 400 });
    }

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    const feedback: FeedbackData = {
      message,
      question: question || null,
      rating: rating as 'thumbs-up' | 'thumbs-down',
      feedbackText: feedbackText || null,
      operatingSystem: operatingSystem || null,
      ipAddress,
      timestamp: new Date().toISOString(),
    };

    feedbacks.push(feedback);

    console.log('Received feedback:', feedback);

    return NextResponse.json({ message: 'Feedback received successfully', feedback }, { status: 200 });
  } catch (error: unknown) {
    console.error('Error processing feedback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function GET() {
  try {
    return NextResponse.json({ feedbacks, total: feedbacks.length }, { status: 200 });
  } catch (error: unknown) {
    console.error('Error retrieving feedbacks:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}