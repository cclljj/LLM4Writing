export type StructureTreeNodePermissions = {
  canAddChild: boolean;
  canDelete: boolean;
  canEditText: boolean;
};

export function getStructureTreeNodePermissions(depth: number, childCount: number): StructureTreeNodePermissions {
  if (depth <= 1) {
    return { canAddChild: false, canDelete: false, canEditText: false };
  }

  if (depth === 2) {
    return { canAddChild: true, canDelete: false, canEditText: false };
  }

  return {
    canAddChild: true,
    canDelete: childCount === 0,
    canEditText: true
  };
}
