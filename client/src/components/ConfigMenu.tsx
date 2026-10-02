// client/src/components/ConfigMenu.tsx

import { useEffect, useRef, useState } from 'react'
import type { ClientProject, Project } from '../api'
import { projectOptions } from '../projects'

type Props = {
  // active client codes, in configured order
  clients: string[]
  projects: Project[]
  defaultClient: string | null
  defaultProject: ClientProject | null
  settingsHref: string
  onChangeDefault: (client: string) => void
  onChangeDefaultProject: (project: ClientProject) => void
  onClearDefault: () => void
  onClearDefaultProject: () => void
}

export const ConfigMenu = ({
  clients,
  projects,
  defaultClient,
  defaultProject,
  settingsHref,
  onChangeDefault,
  onChangeDefaultProject,
  onClearDefault,
  onClearDefaultProject,
}: Props) => {
  const [open, setOpen] = useState(false)
  const clientProjects = defaultClient ? projectOptions(projects, defaultClient) : []
  const rootRef = useRef<HTMLDivElement>(null)

  // dismiss on Escape or a click outside the menu
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
    }
  }, [open])

  return (
    <div className="config-menu" ref={rootRef}>
      <button
        className="config-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        title="Settings"
      >
        {'⚙' /* gear (⚙) */}
      </button>
      {open && (
        <div className="config-popover" role="menu">
          <div className="config-columns">
            <div className="config-column">
              <div className="config-section-label">Default client</div>
              <div className="config-client-list">
                {clients.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="menuitemradio"
                    aria-checked={c === defaultClient}
                    className={`config-client-option${c === defaultClient ? ' selected' : ''}`}
                    onClick={() => onChangeDefault(c)}
                  >
                    <span className="config-check">{c === defaultClient ? '✓' : ''}</span>
                    {c}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="ghost config-clear"
                onClick={onClearDefault}
                disabled={!defaultClient}
              >
                Clear default
              </button>
            </div>
            {/* projects belong to a client, so a default project only makes sense
                 under a default client, chosen from that client's own projects */}
            {defaultClient && (
              <div className="config-column">
                <div className="config-section-label">Default project</div>
                {clientProjects.length === 0 && (
                  <div className="config-empty">No {defaultClient} projects yet</div>
                )}
                <div className="config-client-list">
                  {clientProjects.map((p) => {
                    const selected =
                      defaultProject?.client === defaultClient && defaultProject.project === p
                    return (
                      <button
                        key={p}
                        type="button"
                        role="menuitemradio"
                        aria-checked={selected}
                        className={`config-client-option config-project-option${selected ? ' selected' : ''}`}
                        onClick={() => onChangeDefaultProject({ client: defaultClient, project: p })}
                      >
                        <span className="config-check">{selected ? '✓' : ''}</span>
                        <span className="config-project-name">{p}</span>
                      </button>
                    )
                  })}
                </div>
                <button
                  type="button"
                  className="ghost config-clear"
                  onClick={onClearDefaultProject}
                  disabled={!defaultProject}
                >
                  Clear default
                </button>
              </div>
            )}
          </div>
          <a className="config-advanced" href={settingsHref} role="menuitem">
            › Advanced settings
          </a>
        </div>
      )}
    </div>
  )
}
