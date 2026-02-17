import { FILE_POLICY } from '@/constants/file'
import { getDirectoryPath, joinPath } from '@/utils/imagePath'
import { invokeTauri } from '@/utils/tauri'

interface DirectoryEntry {
  name: string
  is_directory: boolean
  size: number
  modified: number
}

interface CopyPathResult {
  copyName: string
  copyPath: string
}

/**
 * Finds an available copy path for a file by checking existing directory entries.
 * Uses a single IPC call to list_directory instead of multiple read_file attempts.
 *
 * @param filePath - The original file path to duplicate
 * @returns Object with copyName and copyPath, or null if no name available after max attempts
 */
export async function findAvailableCopyPath(filePath: string): Promise<CopyPathResult | null> {
  const dir = getDirectoryPath(filePath)

  // Get the file name and split into base name and extension
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  const fullName = lastSlash === -1 ? filePath : filePath.slice(lastSlash + 1)
  const dotIdx = fullName.lastIndexOf('.')
  const name = dotIdx > 0 ? fullName.slice(0, dotIdx) : fullName
  const ext = dotIdx > 0 ? fullName.slice(dotIdx) : ''

  // Fetch all entries in the directory once
  let entries: DirectoryEntry[]
  try {
    entries = await invokeTauri<DirectoryEntry[]>('list_directory', { path: dir })
  } catch {
    // If directory listing fails, fall back to null
    return null
  }

  // Build a set of existing file names for fast lookup
  const existingNames = new Set(entries.map(e => e.name))

  // Try to find an available name
  let copyName = `${name} (copy)${ext}`
  if (!existingNames.has(copyName)) {
    return { copyName, copyPath: joinPath(dir, copyName) }
  }

  // Try numbered copies: "file (copy 2).md", "file (copy 3).md", etc.
  for (let i = 2; i <= FILE_POLICY.maxCopyAttempts; i++) {
    copyName = `${name} (copy ${i})${ext}`
    if (!existingNames.has(copyName)) {
      return { copyName, copyPath: joinPath(dir, copyName) }
    }
  }

  // No available name found after max attempts
  return null
}
