import { NextRequest, NextResponse } from 'next/server';

let feedbacks: any[] = [];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, question, rating, feedbackText, operatingSystem } = body;

    if (!message || !rating || !['thumbs-up', 'thumbs-down'].includes(rating)) {
      return NextResponse.json({ error: 'Invalid feedback data' }, { status: 400 });
    }

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

    const feedback = {
      message,
      question: question || null,
      rating,
      feedbackText: feedbackText || null,
      operatingSystem: operatingSystem || null,
      ipAddress,
      timestamp: new Date().toISOString(),
    };

    feedbacks.push(feedback);

    console.log('Received feedback:', feedback);

    return NextResponse.json({ message: 'Feedback received successfully', feedback }, { status: 200 });
  } catch (error: any) {
    console.error('Error processing feedback:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json({ feedbacks, total: feedbacks.length }, { status: 200 });
  } catch (error: any) {
    console.error('Error retrieving feedbacks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}