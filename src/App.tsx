import { useState, type FormEvent } from 'react'
import { Analytics } from '@vercel/analytics/react'
import './App.css'

interface MediaItem {
  id: string
  type: 'image' | 'video'
  url: string
  downloadUrl: string
  thumbnailUrl?: string
  filename: string
  order: number
}

interface MediaResponse {
  media?: MediaItem[]
  error?: string
  code?: string
}

const apiBaseUrl = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')

function getInstagramPost(url: string): { url: string; shortcode: string } | null {
  let parsedUrl

  try {
    parsedUrl = new URL(url)
  } catch {
    return null
  }

  const isInstagramHost = ['instagram.com', 'instagr.am'].some(
    (domain) => parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`),
  )
  const match = parsedUrl.pathname.match(/^\/(?:p|reel|tv)\/([\w-]+)\/?$/)

  if (!isInstagramHost || !match) return null

  return { url: parsedUrl.href, shortcode: match[1] }
}

function App() {
  const [postUrl, setPostUrl] = useState('')
  const [media, setMedia] = useState<MediaItem[]>([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [downloadingUrl, setDownloadingUrl] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMedia([])

    const post = getInstagramPost(postUrl.trim())
    if (!post) {
      setError('Please enter a valid Instagram post, reel, or carousel link.')
      return
    }

    if (!import.meta.env.DEV && !apiBaseUrl) {
      setError('The media server is not configured. Please contact the site administrator.')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`${apiBaseUrl}/api/download-ig-post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postUrl: post.url }),
      })

      const result: MediaResponse = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (response.status === 400) {
          setError('Please enter a valid Instagram post, reel, or carousel link.')
        } else if (response.status === 404) {
          if (result.code === 'NO_MEDIA') {
            setError('No downloadable media was found in this post.')
          } else if (result.code === 'POST_UNAVAILABLE') {
            setError('This post could not be found or accessed. It may be deleted, private, or require sign-in.')
          } else {
            setError('Internal server error. Please try again later.')
          }
        } else if (response.status === 429) {
          setError('Too many requests. Please wait a moment and try again.')
        } else {
          setError('Internal server error. Please try again later.')
        }
        return
      }

      if (!Array.isArray(result.media) || result.media.length === 0) {
        setError('No downloadable media was found in this post.')
        return
      }

      setMedia(result.media)
    } catch {
      setError('Could not connect to the server. Please try again later.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDownload(item: MediaItem, index: number) {
    setError('')
    setDownloadingUrl(item.url)

    try {
      if (!import.meta.env.DEV && !apiBaseUrl) {
        setError('The media server is not configured. Please contact the site administrator.')
        return
      }

      const response = await fetch(`${apiBaseUrl}${item.downloadUrl}`)
      if (!response.ok) {
        setError(response.status === 404
          ? 'This download link expired. Process the post again.'
          : 'Internal server error. Please try again later.')
        return
      }

      const objectUrl = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = item.filename || `instagram-media-${index + 1}`
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    } catch {
      setError('Could not connect to the server. Please try again later.')
    } finally {
      setDownloadingUrl('')
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="Frame home">
          <span className="wordmark-mark" aria-hidden="true">F</span>
          <span>frame<span className="wordmark-period">.</span></span>
        </a>
        <span className="topbar-note"><span className="status-dot" /> POST MEDIA TOOL</span>
      </header>

      <section className="workspace" aria-labelledby="page-title">
        <div className="intro">
          <p className="eyebrow"><span>01</span> &nbsp; PASTE A POST</p>
          <h1 id="page-title">Instagram<br /><em>downloader.</em></h1>
          <p className="intro-copy">Download photos and videos from public Instagram posts, reels, and carousels. Paste a link to preview each item and save media you have permission to use.</p>
        </div>

        <form className="link-form" onSubmit={handleSubmit}>
          <label htmlFor="post-url">Instagram post link</label>
          <div className="input-row">
            <input
              id="post-url"
              type="url"
              inputMode="url"
              autoComplete="url"
              placeholder="https://www.instagram.com/p/..."
              value={postUrl}
              onChange={(event) => setPostUrl(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
                  event.preventDefault()
                  event.currentTarget.select()
                }
              }}
              aria-describedby={error ? 'form-message' : 'form-hint'}
            />
            <button type="submit" disabled={isLoading || !postUrl.trim()}>
              {isLoading ? <><span className="spinner" /> Finding media</> : <>Get media <span aria-hidden="true">↗</span></>}
            </button>
          </div>
          <p className={error ? 'form-message is-error' : 'form-hint'} id={error ? 'form-message' : 'form-hint'} role={error ? 'alert' : undefined}>
            {error || 'Public posts only. Please respect the creator’s rights.'}
          </p>
        </form>
      </section>

      <section className="results" aria-live="polite" aria-label="Post media results">
        <div className="results-heading">
          <div>
            <p className="eyebrow"><span>02</span> &nbsp; YOUR RESULTS</p>
            <h2>{media.length ? 'Ready to save' : 'Media appears here'}</h2>
          </div>
          {media.length > 0 && <span className="media-count">{String(media.length).padStart(2, '0')} ITEMS</span>}
        </div>

        {media.length > 0 ? (
          <div className="media-grid">
            {media.map((item, index) => (
                <article className="media-item" key={item.id}>
                <div className="media-preview">
                  {item.type === 'video' ? (
                    <video controls preload="metadata" poster={item.thumbnailUrl || undefined} src={item.url} aria-label={`Video ${index + 1}`} />
                  ) : (
                    <img src={item.thumbnailUrl || item.url} alt={`Instagram post media ${index + 1}`} loading="lazy" />
                  )}
                  <span className="media-index">{String(index + 1).padStart(2, '0')}</span>
                </div>
                <div className="media-meta">
                  <span>{item.type === 'video' ? 'VIDEO' : 'PHOTO'} <span className="meta-divider">/</span> {item.filename || `Media ${index + 1}`}</span>
                  <button className="download-button" type="button" onClick={() => handleDownload(item, index)} disabled={downloadingUrl === item.url}>
                    {downloadingUrl === item.url ? 'Saving…' : 'Download'} <span aria-hidden="true">↓</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-mark" aria-hidden="true">↳</span>
            <p>Paste a link above to see every photo and video in the post.</p>
          </div>
        )}
      </section>

      <section className="seo-content" aria-labelledby="downloader-info-title">
        <h2 id="downloader-info-title">Instagram post, photo, and video downloader</h2>
        <p>
          Frame is an online Instagram downloader for viewing and saving photos and videos from public posts.
          Paste a post, reel, or carousel link to find its available media in one place, then download the
          items you are authorized to use.
        </p>
        <h3>How do I download media from an Instagram post?</h3>
        <p>
          Copy the link to a public Instagram post and paste it into the field above. Choose Get media to
          preview the available photos or videos, then select Download on the item you want to save.
        </p>
        <h3>Can I download private posts?</h3>
        <p>
          No. This tool only works with public posts that Instagram makes accessible. It cannot access
          private accounts or bypass sign-in restrictions. Only save content when you have permission.
        </p>
      </section>

      <footer className="footer">
        <span>FRAME <span className="wordmark-period">.</span></span>
        <span>Only download media you have permission to use.</span>
      </footer>
      <Analytics />
    </main>
  )
}

export default App
