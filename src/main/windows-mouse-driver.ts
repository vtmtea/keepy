import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { MouseDriver, MousePosition, ScreenBounds } from './mouse-driver'

const executeFile = promisify(execFile)
const POWERSHELL = 'powershell.exe'
const COMMAND = [
  '$signature = @\"',
  'using System;',
  'using System.Runtime.InteropServices;',
  'public static class MouseNative {',
  '  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT point);',
  '  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, int dx, int dy, uint data, UIntPtr extraInfo);',
  '  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);',
  '  [DllImport("user32.dll")] public static extern IntPtr MonitorFromPoint(POINT point, uint flags);',
  '  [DllImport("user32.dll")] public static extern bool GetMonitorInfo(IntPtr monitor, ref MONITORINFO info);',
  '  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }',
  '  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }',
  '  [StructLayout(LayoutKind.Sequential)] public struct MONITORINFO { public int cbSize; public RECT rcMonitor; public RECT rcWork; public uint dwFlags; }',
  '}',
  '\"@',
  'Add-Type -TypeDefinition $signature',
  '$action = $env:KEEPY_MOUSE_ACTION',
  'if ($action -eq "get") {',
  '  $point = New-Object MouseNative+POINT',
  '  [MouseNative]::GetCursorPos([ref]$point) | Out-Null',
  '  Write-Output ("{0},{1}" -f $point.X, $point.Y)',
  '} elseif ($action -eq "bounds") {',
  '  $point = New-Object MouseNative+POINT',
  '  $point.X = [int]$env:KEEPY_MOUSE_X',
  '  $point.Y = [int]$env:KEEPY_MOUSE_Y',
  '  $monitor = [MouseNative]::MonitorFromPoint($point, 2)',
  '  $info = New-Object MouseNative+MONITORINFO',
  '  $info.cbSize = [Runtime.InteropServices.Marshal]::SizeOf($info)',
  '  [MouseNative]::GetMonitorInfo($monitor, [ref]$info) | Out-Null',
  '  Write-Output ("{0},{1},{2},{3}" -f $info.rcMonitor.Left, $info.rcMonitor.Top, $info.rcMonitor.Right, $info.rcMonitor.Bottom)',
  '} elseif ($action -eq "move") {',
  '  [MouseNative]::SetCursorPos([int]$env:KEEPY_MOUSE_X, [int]$env:KEEPY_MOUSE_Y) | Out-Null',
  '  [MouseNative]::mouse_event(0x0001, 0, 0, 0, [UIntPtr]::Zero)',
  '} elseif ($action -eq "click") {',
  '  [MouseNative]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)',
  '  [MouseNative]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)',
  '}'
].join('\n')

export class WindowsMouseDriver implements MouseDriver {
  async getPosition(): Promise<MousePosition> {
    const output = await runPowerShell('get')
    const [x, y] = output.split(',').map(Number)
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error('无法读取鼠标位置。')
    }
    return { x, y }
  }

  async getScreenBoundsAt(position: MousePosition): Promise<ScreenBounds> {
    const output = await runPowerShell('bounds', position)
    const [left, top, right, bottom] = output.split(',').map(Number)
    if (![left, top, right, bottom].every(Number.isFinite) || right <= left || bottom <= top) {
      throw new Error('无法读取显示器边界。')
    }
    return { x: left, y: top, width: right - left, height: bottom - top }
  }

  async moveTo(position: MousePosition): Promise<void> {
    await runPowerShell('move', position)
  }

  async click(): Promise<void> {
    await runPowerShell('click')
  }
}

async function runPowerShell(action: string, position?: MousePosition): Promise<string> {
  const { stdout } = await executeFile(POWERSHELL, [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    COMMAND
  ], {
    encoding: 'utf8',
    windowsHide: true,
    env: {
      ...process.env,
      KEEPY_MOUSE_ACTION: action,
      KEEPY_MOUSE_X: String(position?.x ?? ''),
      KEEPY_MOUSE_Y: String(position?.y ?? '')
    }
  })
  return stdout.trim()
}
