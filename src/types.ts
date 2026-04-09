export type CropStatus = 'planted' | 'harvested' | 'sold';

export interface CropRecord {
  id: string;
  userId: string;
  name: string;
  quantity: number;
  plantingDate: string;
  harvestDate?: string;
  investmentAmount: number;
  saleAmount?: number;
  status: CropStatus;
  createdAt: any; // Firestore Timestamp
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
