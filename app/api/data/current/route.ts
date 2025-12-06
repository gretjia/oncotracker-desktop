import { NextResponse, NextRequest } from 'next/server';
import { loadDataset } from '@/lib/data-loader';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const patientId = searchParams.get('patientId') || undefined;
        
        const dataset = await loadDataset(patientId);
        return NextResponse.json(dataset);
    } catch (error) {
        console.error("Error loading dataset:", error);
        return NextResponse.json({ error: "Failed to load dataset" }, { status: 500 });
    }
}
