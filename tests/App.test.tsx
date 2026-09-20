import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { keepyApi } from '../src/lib/keepy-api'

vi.mock('../src/lib/keepy-api', () => ({
  keepyApi: {
    getSettings: vi.fn(),
    getStatus: vi.fn(),
    saveSettings: vi.fn(),
    start: vi.fn(),
    pause: vi.fn(),
    resolveClose: vi.fn(),
    onStatus: vi.fn(),
    onCloseRequest: vi.fn()
  }
}))

const settings = {
  version: 1,
  intervalSeconds: 60,
  mode: 'move' as const,
  clickAcknowledged: false
}
const status = {
  phase: 'paused' as const,
  intervalSeconds: 60,
  mode: 'move' as const,
  lastActionAt: null,
  nextActionAt: null,
  errorMessage: null
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(keepyApi.getSettings).mockResolvedValue(settings)
  vi.mocked(keepyApi.getStatus).mockResolvedValue(status)
  vi.mocked(keepyApi.onStatus).mockResolvedValue(() => undefined)
  vi.mocked(keepyApi.onCloseRequest).mockResolvedValue(() => undefined)
  vi.mocked(keepyApi.saveSettings).mockResolvedValue(settings)
  vi.mocked(keepyApi.start).mockResolvedValue({ ...status, phase: 'running', nextActionAt: Date.now() + 60_000 })
  vi.mocked(keepyApi.pause).mockResolvedValue(status)
})

describe('Keepy control panel', () => {
  it('loads settings and saves edited interval', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByText('鼠标活动助手')).toBeInTheDocument()
    const interval = screen.getByRole('spinbutton', { name: '动作间隔' })
    await user.clear(interval)
    await user.type(interval, '90')
    await user.click(screen.getByRole('button', { name: '保存设置' }))

    await waitFor(() => expect(keepyApi.saveSettings).toHaveBeenCalledWith({
      intervalSeconds: 90,
      mode: 'move',
      clickAcknowledged: false
    }))
    expect(await screen.findByText('设置已保存。')).toBeInTheDocument()
  })

  it('requires confirmation before saving click mode', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('鼠标活动助手')

    await user.click(screen.getByRole('radio', { name: /点击当前鼠标位置/ }))
    await user.click(screen.getByRole('button', { name: '保存设置' }))

    expect(await screen.findByText('请确认点击模式的影响后再启动。')).toBeInTheDocument()
    expect(keepyApi.saveSettings).not.toHaveBeenCalled()
  })

  it('saves before starting activity', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('鼠标活动助手')
    vi.mocked(keepyApi.saveSettings).mockResolvedValue(settings)

    await user.click(screen.getByRole('button', { name: '开始 Keepy' }))

    await waitFor(() => expect(keepyApi.start).toHaveBeenCalledOnce())
    expect(keepyApi.saveSettings).toHaveBeenCalledOnce()
  })
})
