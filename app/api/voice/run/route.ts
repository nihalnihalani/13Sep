import { NextResponse } from "next/server";

export const runtime = 'nodejs';

type Demographic = {
  title: string;
  description?: string;
  city?: string;
  country?: string;
};

async function push(session: string, message: string, agentId?: string, status?: "start" | "success" | "error" | "info", data?: any) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/progress/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session, message, agentId, status, data })
    });
  } catch {}
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const session: string = String(body?.session || 'voice');
    const imageUrl: string | undefined = body?.imageUrl;
    const demographics: Demographic[] = Array.isArray(body?.demographics) ? body.demographics : [];

    if (!demographics.length) {
      await push(session, 'Voice run aborted: no demographics provided.', 'voice.run', 'error');
      return NextResponse.json({ ok: false, error: 'No demographics' }, { status: 400 });
    }

    // 1) Analyze image (optional)
    if (imageUrl) {
      await push(session, 'Analyzing image from URL...', 'vision.analyze', 'start', { imageUrl });
      try {
        const res = await fetch(imageUrl);
        if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
        const ab = await res.arrayBuffer();
        const blob = new Blob([ab], { type: res.headers.get('content-type') || 'image/png' });
        const form = new FormData();
        form.append('image', blob, 'input');
        const analyze = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/vision/analyze`, { method: 'POST', body: form });
        if (!analyze.ok) throw new Error(await analyze.text());
        const insights = await analyze.json();
        await push(session, 'Image analysis complete.', 'vision.analyze', 'success', { insights });
      } catch (e: any) {
        await push(session, `Image analysis failed: ${e?.message || e}`, 'vision.analyze', 'error');
      }
    }

    // 2) For each demographic: get cultural signals, build prompt, generate image
    await push(session, `Fetching cultural signals for default campaign + ${demographics.length} demographics...`, 'cultural.intelligence', 'start');
    for (const d of demographics) {
      const city = d.city || d.title;
      const country = d.country || d.title;
      const culturalResp = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/cultural/intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, country, analysisDepth: 'basic' })
      });
      const cultural = culturalResp.ok ? await culturalResp.json() : { analysis: {} };
      const culture = cultural?.analysis || {};
      const cultureHints = JSON.stringify({ aesthetics: culture?.aesthetics, communication: culture?.communication, themes: culture?.themes });
      const prompt = [
        d.description ? `Demographic details: ${d.description}` : '',
        cultureHints ? `Relevant cultural cues: ${cultureHints}` : '',
        `Create a visually striking, brand-safe image tailored to ${d.title}${d.city || d.country ? ` (${[d.city, d.country].filter(Boolean).join(', ')})` : ''}.`
      ].filter(Boolean).join('\n');

      await push(session, `Generating image for ${d.title}...`, 'imagen.generate', 'start', { demographic: d });
      const gen = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/imagen/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      if (!gen.ok) {
        await push(session, `Image failed for ${d.title}: ${gen.status}`, 'imagen.generate', 'error');
      } else {
        const img = await gen.json().catch(() => null);
        await push(session, `Image ready for ${d.title}.`, 'imagen.generate', 'success', { image: img?.image, media: img?.media });
      }
    }

    // 3) For each demographic: generate video and poll
    await push(session, 'Generating videos one-by-one for default campaign + demographics...', 'veo.generate', 'start');
    for (const d of demographics) {
      const prompt = d.description ? `${d.title}: ${d.description}` : d.title;
      await push(session, `Generating video for ${d.title}...`, 'veo.generate', 'start', { demographic: d });
      const form = new FormData();
      form.append('prompt', prompt);
      form.append('model', 'veo-3.0-generate-001');
      const resp = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/veo/generate`, { method: 'POST', body: form });
      if (!resp.ok) {
        await push(session, `Video start failed for ${d.title}: ${resp.status}`, 'veo.generate', 'error');
        continue;
      }
      const gen = await resp.json();
      const name = gen?.name as string | undefined;
      if (!name) {
        await push(session, `Video operation missing name for ${d.title}.`, 'veo.operation', 'error');
        continue;
      }
      let attempts = 0;
      let delay = 2000;
      let fileUri: string | null = null;
      const maxAttempts = 36;
      while (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, delay));
        const op = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/veo/operation`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name })
        });
        if (op.ok) {
          const fresh = await op.json();
          if (fresh?.done) {
            const primary = fresh?.response?.candidates?.[0]?.content?.parts?.[0]?.file_data?.file_uri;
            const alt = fresh?.response?.candidates?.[0]?.content?.parts?.find((p: any) => p?.video_metadata?.file_uri)?.video_metadata?.file_uri;
            const fromList = Array.isArray(fresh?.uris) && fresh.uris.length > 0 ? fresh.uris[0] : null;
            fileUri = primary || alt || fromList || null;
            await push(session, `Video operation completed for ${d.title}.`, 'veo.operation', 'success', { uris: fresh?.uris });
            break;
          }
        }
        delay = Math.min(delay + 1000, 8000);
        attempts++;
      }
      if (!fileUri) {
        await push(session, `${d.title} video pending/failed.`);
        continue;
      }
      const dl = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/veo/download`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uri: fileUri, save: true })
      });
      if (!dl.ok) {
        await push(session, `Download/save failed for ${d.title}: ${dl.status}`, 'veo.download', 'error');
      } else {
        const saved = await dl.json();
        await push(session, `Saved video URL for ${d.title}: ${saved?.url || 'n/a'}`, 'veo.download', 'success', { media: saved });
      }
    }

    await push(session, 'Voice flow complete.', 'voice.run', 'success');
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed' }, { status: 500 });
  }
}
