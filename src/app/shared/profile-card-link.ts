/** The card of a Салон or of a Незалежний майстер — where every row naming one leads. */
export function profileCardLink(kind: 'salon' | 'independentMaster', id: string): string[] {
  return kind === 'salon' ? ['/salons', id] : ['/independent-masters', id];
}
