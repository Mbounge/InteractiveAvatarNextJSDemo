import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function GET() {
  try {
    const agentPath = path.resolve(process.cwd(), '/Users/mbounge/Desktop/Heygen/app/lib/agent.mts'); 
    spawn('node', [agentPath], { stdio: 'inherit', detached: true });

    return NextResponse.json({ success: true, message: 'LiveKit voice agent started2' });
  } catch (error) {
    const err = error as Error
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}