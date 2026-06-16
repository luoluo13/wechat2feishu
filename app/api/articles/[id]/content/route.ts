
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    const article = await prisma.article.findUnique({
      where: { id },
      select: { content: true, contentHtml: true, userId: true, title: true }
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Security: Only allow owner to fetch content (unless it's public/trending? 
    // For now, let's keep it restricted or allow if it's "completed" and status is okay)
    // Actually, if we want to allow "Preview", it should be accessible.
    // If it's a personal article and user is logged in, check ownership.
    // If user is not logged in, check if article has no userId (anonymous).
    
    if (article.userId && article.userId !== session?.user?.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ 
        content: article.content,
        contentHtml: article.contentHtml,
        title: article.title 
    });
  } catch (error) {
    console.error('Fetch content error:', error);
    return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 });
  }
}
