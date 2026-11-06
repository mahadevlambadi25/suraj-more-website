'use client';

import { useEffect, useRef, useState } from 'react';
import { track } from '@/lib/analytics';
import type { VideoRef } from '@/lib/types';
import { Play } from './Icons';

const MILESTONES = [25, 50, 75, 100];

/**
 * Click-to-play facade: no third-party player loads until the visitor clicks (protects LCP/INP).
 * Reports video_progress at 25/50/75/100% for YouTube and Vimeo via postMessage.
 */
export function VideoPlayer({ video, label }: { video: VideoRef | null; label?: string }) {
  const [playing, setPlaying] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const fired = useRef(new Set<number>());

  useEffect(() => {
    if (!playing || !video) return;
    const report = (pct: number) => {
      for (const m of MILESTONES) {
        if (pct >= m - 0.5 && !fired.current.has(m)) {
          fired.current.add(m);
          track('video_progress', { video_id: video.id, provider: video.provider, percent: m === 100 ? 'complete' : m });
        }
      }
    };

    let duration = 0;
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      let data: unknown = e.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      const d = data as { event?: string; info?: { currentTime?: number; duration?: number }; data?: { percent?: number } };
      if (video.provider === 'youtube' && d.event === 'infoDelivery' && d.info) {
        if (d.info.duration) duration = d.info.duration;
        if (duration && typeof d.info.currentTime === 'number') report((d.info.currentTime / duration) * 100);
      }
      if (video.provider === 'vimeo' && (d.event === 'timeupdate' || d.event === 'playProgress') && d.data?.percent != null) {
        report(d.data.percent * 100);
      }
      if (video.provider === 'vimeo' && d.event === 'ready') {
        frame.current?.contentWindow?.postMessage(JSON.stringify({ method: 'addEventListener', value: 'timeupdate' }), '*');
      }
    };
    window.addEventListener('message', onMessage);

    const onLoad = () => {
      if (video.provider === 'youtube') {
        frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*');
      } else {
        frame.current?.contentWindow?.postMessage(JSON.stringify({ method: 'addEventListener', value: 'timeupdate' }), '*');
      }
    };
    const el = frame.current;
    el?.addEventListener('load', onLoad);
    return () => {
      window.removeEventListener('message', onMessage);
      el?.removeEventListener('load', onLoad);
    };
  }, [playing, video]);

  if (!video) {
    return (
      <div className="video video-placeholder" role="img" aria-label="Video coming soon">
        <div>
          <p style={{ margin: 0, color: '#c4cbd5', fontWeight: 600 }}>Training video will appear here</p>
          <p className="small" style={{ margin: '6px 0 0' }}>Add the unlisted YouTube/Vimeo ID in site settings.</p>
        </div>
      </div>
    );
  }

  const src =
    video.provider === 'youtube'
      ? `https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1&cc_load_policy=${video.captions ? 1 : 0}&origin=${typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : ''}`
      : `https://player.vimeo.com/video/${video.id}?autoplay=1&dnt=1&title=0&byline=0&portrait=0${video.captions ? '&texttrack=en' : ''}`;

  return (
    <div>
      <div className="video">
        {playing ? (
          <iframe ref={frame} src={src} title={video.title} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen />
        ) : (
          <button type="button" className="video-poster" onClick={() => setPlaying(true)} aria-label={`Play video: ${video.title}`}>
            {video.poster && <img src={video.poster} alt="" loading="lazy" width={1280} height={720} />}
            <span className="play">
              <Play />
            </span>
            <span className="label">{label ?? video.title}</span>
          </button>
        )}
      </div>
      {video.transcript && (
        <details className="transcript">
          <summary>Read the transcript</summary>
          <div className="prose small">
            {video.transcript.split('\n\n').map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
