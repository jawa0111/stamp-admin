import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'
import { Card, CardHeader } from './ui/PageHeader'
import Spinner from './ui/Spinner'
import { Film, Images, UploadCloud, Trash2, ExternalLink, X } from 'lucide-react'

// Keys stored in the site_settings table (read by the storefront Home hero)
const VIDEO_KEY = 'hero_video'
const POSTER_KEY = 'hero_poster'
const IMAGES_KEY = 'hero_images' // JSON array of image URLs
const MODE_KEY = 'hero_mode' // 'video' | 'images'
const LIVE_KEY = 'hero_live' // '1' = show custom intro on the storefront

function parseImages(value) {
  try {
    const arr = JSON.parse(value ?? '[]')
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export default function HeroVideoSettings() {
  const toast = useToast()
  const videoRef = useRef(null)
  const posterRef = useRef(null)
  const imagesRef = useRef(null)

  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [mode, setMode] = useState('video') // 'video' | 'images'
  const [video, setVideo] = useState('')
  const [poster, setPoster] = useState('')
  const [images, setImages] = useState([])
  const [live, setLive] = useState(false)
  const [savingLive, setSavingLive] = useState(false)
  const [uploading, setUploading] = useState(null) // 'video' | 'poster' | 'images' | null

  async function setKey(key, value) {
    const { error } = await supabase.from('site_settings').upsert({ key, value })
    if (error) toast(error.message, 'error')
    return !error
  }

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', [VIDEO_KEY, POSTER_KEY, IMAGES_KEY, MODE_KEY, LIVE_KEY])
    if (error) {
      setMissing(true)
      setLoading(false)
      return
    }
    const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))
    setVideo(map[VIDEO_KEY] ?? '')
    setPoster(map[POSTER_KEY] ?? '')
    setImages(parseImages(map[IMAGES_KEY]))
    setMode(map[MODE_KEY] === 'images' ? 'images' : 'video')
    setLive(map[LIVE_KEY] === '1')
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function changeMode(next) {
    if (next === mode) return
    setMode(next)
    await setKey(MODE_KEY, next)
  }

  // Upload one file to site-media and return its public URL
  async function uploadFile(file, prefix, fallbackExt) {
    const ext = file.name.split('.').pop()?.toLowerCase() || fallbackExt
    const path = `hero/${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`
    const { error } = await supabase.storage
      .from('site-media')
      .upload(path, file, { cacheControl: '31536000', upsert: false })
    if (error) {
      toast(`Upload failed: ${error.message}`, 'error')
      return null
    }
    return supabase.storage.from('site-media').getPublicUrl(path).data.publicUrl
  }

  async function uploadVideo(file) {
    if (!file) return
    setUploading('video')
    const url = await uploadFile(file, 'video', 'mp4')
    if (url && (await setKey(VIDEO_KEY, url))) {
      setVideo(url)
      toast('Intro video updated')
    }
    setUploading(null)
  }

  async function uploadPoster(file) {
    if (!file) return
    setUploading('poster')
    const url = await uploadFile(file, 'poster', 'jpg')
    if (url && (await setKey(POSTER_KEY, url))) {
      setPoster(url)
      toast('Poster image updated')
    }
    setUploading(null)
  }

  async function uploadImages(files) {
    if (!files?.length) return
    setUploading('images')
    const urls = []
    for (const file of files) {
      const url = await uploadFile(file, 'img', 'jpg')
      if (url) urls.push(url)
    }
    if (urls.length) {
      const next = [...images, ...urls]
      setImages(next)
      await setKey(IMAGES_KEY, JSON.stringify(next))
      toast(`${urls.length} image${urls.length > 1 ? 's' : ''} added`)
    }
    setUploading(null)
  }

  async function removeImage(url) {
    const next = images.filter((u) => u !== url)
    setImages(next)
    await setKey(IMAGES_KEY, JSON.stringify(next))
  }

  async function clearValue(key, kind) {
    if (!(await setKey(key, ''))) return
    if (kind === 'video') setVideo('')
    else setPoster('')
    toast('Removed — the site will use its default.')
  }

  async function toggleLive() {
    const ready = mode === 'video' ? !!video : images.length > 0
    if (!ready) {
      return toast(
        mode === 'video'
          ? 'Upload an intro video first, then go live.'
          : 'Add at least one image first, then go live.',
        'error'
      )
    }
    const next = !live
    setSavingLive(true)
    if (await setKey(LIVE_KEY, next ? '1' : '0')) {
      setLive(next)
      toast(next ? 'Intro is now live on the site' : 'Intro hidden — site shows default')
    }
    setSavingLive(false)
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
            in the Supabase SQL editor, then reload this page.
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
        {/* Mode selector */}
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-ink-100 p-1">
          {[
            { id: 'video', label: 'Video', icon: Film },
            { id: 'images', label: 'Image slideshow', icon: Images },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => changeMode(id)}
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                mode === id ? 'bg-surface text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800'
              }`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        {/* Go live toggle */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-ink-200 bg-ink-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Show custom intro on the site</p>
            <p className="mt-0.5 text-xs text-ink-400">
              {live
                ? `Visitors currently see your ${mode === 'video' ? 'video' : 'image(s)'}.`
                : 'Off — visitors see the default until you go live.'}
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

        {mode === 'video' ? (
          <>
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
                  uploadVideo(e.target.files[0])
                  e.target.value = ''
                }}
              />
            </div>

            <div className="border-t border-ink-100" />

            {/* Poster image */}
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Images size={16} className="text-ink-400" /> Poster image
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
                  uploadPoster(e.target.files[0])
                  e.target.value = ''
                }}
              />
            </div>
          </>
        ) : (
          /* Image slideshow */
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Images size={16} className="text-ink-400" /> Slideshow images
              <span className="font-normal text-ink-400">
                — one shows static; several rotate one by one
              </span>
            </div>

            {images.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {images.map((url, i) => (
                  <div
                    key={url}
                    className="group relative aspect-video overflow-hidden rounded-lg border border-ink-200"
                  >
                    <img src={url} alt={`Slide ${i + 1}`} className="size-full object-cover" />
                    <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeImage(url)}
                      className="absolute right-1 top-1 cursor-pointer rounded-md bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                      aria-label="Remove image"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-ink-300 bg-ink-50 px-4 py-6 text-center text-sm text-ink-400">
                No images yet — the site shows its default.
              </p>
            )}

            <button
              onClick={() => imagesRef.current?.click()}
              disabled={uploading === 'images'}
              className="mt-2.5 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {uploading === 'images' ? <Spinner size={15} className="text-white" /> : <UploadCloud size={15} />}
              {uploading === 'images' ? 'Uploading…' : 'Add images'}
            </button>
            <input
              ref={imagesRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                uploadImages([...e.target.files])
                e.target.value = ''
              }}
            />
          </div>
        )}

        <p className="text-xs text-ink-400">
          Changes go live on the storefront immediately once the toggle is on. Keep videos
          under ~20&nbsp;MB for fast loading.
        </p>
      </div>
    </Card>
  )
}
