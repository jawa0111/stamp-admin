import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import { Card, CardHeader } from './ui/PageHeader'
import Spinner from './ui/Spinner'
import { Film, ImageIcon, UploadCloud, Trash2, ExternalLink } from 'lucide-react'

// Keys stored in the site_settings table (read by the storefront Home hero)
const VIDEO_KEY = 'hero_video'
const POSTER_KEY = 'hero_poster'
const LIVE_KEY = 'hero_live' // '1' = show custom intro on the storefront

export default function HeroVideoSettings() {
  const toast = useToast()
  const videoRef = useRef(null)
  const posterRef = useRef(null)

  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false) // table/bucket not set up yet
  const [video, setVideo] = useState('')
  const [poster, setPoster] = useState('')
  const [live, setLive] = useState(false)
  const [savingLive, setSavingLive] = useState(false)
  const [uploading, setUploading] = useState(null) // 'video' | 'poster' | null

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', [VIDEO_KEY, POSTER_KEY, LIVE_KEY])
    if (error) {
      // Most likely the table doesn't exist yet
      setMissing(true)
      setLoading(false)
      return
    }
    const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))
    setVideo(map[VIDEO_KEY] ?? '')
    setPoster(map[POSTER_KEY] ?? '')
    setLive(map[LIVE_KEY] === '1')
    setLoading(false)
  }

  async function toggleLive() {
    if (!video) {
      return toast('Upload an intro video first, then go live.', 'error')
    }
    const next = !live
    setSavingLive(true)
    const { error } = await supabase
      .from('site_settings')
      .upsert({ key: LIVE_KEY, value: next ? '1' : '0' })
    setSavingLive(false)
    if (error) return toast(error.message, 'error')
    setLive(next)
    toast(next ? 'Intro video is now live on the site' : 'Intro video hidden — site shows default')
  }

  useEffect(() => {
    load()
  }, [])

  async function upload(file, key, kind) {
    if (!file) return
    setUploading(kind)
    const ext = file.name.split('.').pop()?.toLowerCase() || (kind === 'video' ? 'mp4' : 'jpg')
    const path = `hero/${key}-${Date.now()}.${ext}`

    const { error: upErr } = await supabase.storage
      .from('site-media')
      .upload(path, file, { cacheControl: '31536000', upsert: false })
    if (upErr) {
      setUploading(null)
      return toast(`Upload failed: ${upErr.message}`, 'error')
    }

    const { data } = supabase.storage.from('site-media').getPublicUrl(path)
    const { error: saveErr } = await supabase
      .from('site_settings')
      .upsert({ key, value: data.publicUrl })
    setUploading(null)
    if (saveErr) return toast(`Could not save: ${saveErr.message}`, 'error')

    if (kind === 'video') setVideo(data.publicUrl)
    else setPoster(data.publicUrl)
    toast(kind === 'video' ? 'Intro video updated' : 'Poster image updated')
  }

  async function clearValue(key, kind) {
    const { error } = await supabase.from('site_settings').upsert({ key, value: '' })
    if (error) return toast(error.message, 'error')
    if (kind === 'video') setVideo('')
    else setPoster('')
    toast('Removed — the site will use its default.')
  }

  if (loading) {
    return (
      <Card>
        <CardHeader title="Landing page intro" />
        <div className="flex justify-center py-10">
          <Spinner size={24} />
        </div>
      </Card>
    )
  }

  if (missing) {
    return (
      <Card>
        <CardHeader title="Landing page intro" />
        <div className="p-5">
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            Not set up yet. Run{' '}
            <code className="rounded bg-amber-100 px-1 dark:bg-amber-500/20">
              supabase/site_settings.sql
            </code>{' '}
            in the Supabase SQL editor to create the settings table and the{' '}
            <code className="rounded bg-amber-100 px-1 dark:bg-amber-500/20">site-media</code>{' '}
            bucket, then reload this page.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader
        title="Landing page intro"
        action={
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              live
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                : 'bg-ink-100 text-ink-500'
            }`}
          >
            <span className={`size-1.5 rounded-full ${live ? 'bg-emerald-500' : 'bg-ink-400'}`} />
            {live ? 'Live' : 'Not live'}
          </span>
        }
      />
      <div className="space-y-5 p-5">
        {/* Go live toggle */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-ink-200 bg-ink-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Show custom intro on the site</p>
            <p className="mt-0.5 text-xs text-ink-400">
              {live
                ? 'Visitors currently see your uploaded video.'
                : 'Off — visitors see the default clip until you go live.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={live}
            onClick={toggleLive}
            disabled={savingLive}
            className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition disabled:opacity-50 ${
              live ? 'bg-emerald-500' : 'bg-ink-300'
            }`}
            aria-label="Go live"
          >
            <span
              className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${
                live ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        {/* Intro video */}
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Film size={16} className="text-ink-400" /> Intro video
          </div>
          {video ? (
            <div className="overflow-hidden rounded-xl border border-ink-200">
              <video
                key={video}
                src={video}
                controls
                muted
                playsInline
                poster={poster || undefined}
                className="aspect-video w-full bg-black object-contain"
              />
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-ink-300 bg-ink-50 px-4 py-6 text-center text-sm text-ink-400">
              No custom video — the site shows its default clip.
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              onClick={() => videoRef.current?.click()}
              disabled={uploading === 'video'}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {uploading === 'video' ? <Spinner size={15} className="text-white" /> : <UploadCloud size={15} />}
              {uploading === 'video' ? 'Uploading…' : video ? 'Replace video' : 'Upload video'}
            </button>
            {video && (
              <>
                <a
                  href={video}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 px-3 py-2 text-sm font-medium transition hover:bg-ink-100"
                >
                  <ExternalLink size={14} /> Open
                </a>
                <button
                  onClick={() => clearValue(VIDEO_KEY, 'video')}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-ink-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/15"
                >
                  <Trash2 size={14} /> Remove
                </button>
              </>
            )}
          </div>
          <input
            ref={videoRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              upload(e.target.files[0], VIDEO_KEY, 'video')
              e.target.value = ''
            }}
          />
        </div>

        <div className="border-t border-ink-100" />

        {/* Poster image */}
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <ImageIcon size={16} className="text-ink-400" /> Poster image
            <span className="font-normal text-ink-400">— shown while the video loads</span>
          </div>
          {poster ? (
            <img
              src={poster}
              alt="Hero poster"
              className="aspect-video w-full rounded-xl border border-ink-200 object-cover"
            />
          ) : (
            <p className="rounded-xl border border-dashed border-ink-300 bg-ink-50 px-4 py-6 text-center text-sm text-ink-400">
              No poster set.
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              onClick={() => posterRef.current?.click()}
              disabled={uploading === 'poster'}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {uploading === 'poster' ? <Spinner size={15} className="text-white" /> : <UploadCloud size={15} />}
              {uploading === 'poster' ? 'Uploading…' : poster ? 'Replace poster' : 'Upload poster'}
            </button>
            {poster && (
              <button
                onClick={() => clearValue(POSTER_KEY, 'poster')}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-ink-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/15"
              >
                <Trash2 size={14} /> Remove
              </button>
            )}
          </div>
          <input
            ref={posterRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              upload(e.target.files[0], POSTER_KEY, 'poster')
              e.target.value = ''
            }}
          />
        </div>

        <p className="text-xs text-ink-400">
          Changes go live on the storefront immediately. Large videos take longer to
          upload — keep it under ~20&nbsp;MB for fast loading.
        </p>
      </div>
    </Card>
  )
}
