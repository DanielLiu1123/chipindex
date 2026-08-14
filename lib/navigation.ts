export function isActivePath(pathname: string, href: string, includeDescendants = false): boolean {
  return pathname === href || (includeDescendants && pathname.startsWith(`${href}/`))
}
