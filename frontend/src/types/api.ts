export interface LoginData {
    username: string;
    token: string;
}

export interface VersionInfo {
    version: string;
    commitHash: string;
    buildTime: string;
}

export interface PagedResponse<T> {
    data: T[];
    page: number;
    pageSize: number;
    totalPages: number;
    totalData: number;
}

export type CredentialType =
    | "SSH_PRIVATE_KEY"
    | "SSH_PUBLIC_KEY"
    | "TEXT_PASSWORD"
    | "X509_CERTIFICATE";

export type CredentialStatus =
    | "ACTIVE"
    | "IN_USE"
    | "EXPIRING_SOON"
    | "EXPIRED";

export type SSHKeyType = "RSA" | "DSA" | "ECDSA" | "ED25519";

export interface SSHKeyInfo {
    keyType: SSHKeyType;
    bitLength: number;
    curveName: string | null;
    fingerprint: string;
}

export interface CertificateInfo {
    subject: string;
    subjectDn: string;
    issuer: string;
    issuerDn: string;
    serialNumber: string;
    signatureAlgorithm: string;
    publicKeyAlgorithm: string;
    publicKeyBitLength: number;
    notBefore: string;
    notAfter: string;
    fingerprintSha256: string;
    sans: string[];
    selfSigned: boolean;
}

export interface Credential {
    id: string;
    name: string;
    description: string | null;
    credentialType: CredentialType;
    sshPublicKey: string | null;
    sshKeyInfo: SSHKeyInfo | null;
    certificateInfo: CertificateInfo | null;
    expiresAt: string | null;
    status: CredentialStatus;
    createdAt: string;
    updatedAt: string;
}

export interface AddCredentialRequest {
    name: string;
    description: string;
    credentialType: CredentialType;
    sshPublicKey?: string;
    sshPrivateKey?: string;
    sshPrivateKeyPassphrase?: string;
    password?: string;
    certificate?: string;
    certificatePrivateKey?: string;
    certificatePrivateKeyPassphrase?: string;
    expiresAt?: string | null;
}

export interface UpdateCredentialRequest {
    name: string;
    description: string;
    expiresAt?: string | null;
}

export type PlatformType = "HOST" | "DOCKER";

export type InitSystem = "SYSTEMD" | "OPENRC";

export interface AppPlatform {
    id: string;
    name: string;
    description: string | null;
    platformType: PlatformType;
    initSystem: InitSystem | null;
    dockerHost: string | null;
    sshHost: string | null;
    sshPort: number | null;
    sshUsername: string | null;
    credentialId: string | null;
    hostKeys: string[] | null;
    online: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface AppPlatformRequest {
    name: string;
    description: string;
    platformType?: PlatformType;
    initSystem?: InitSystem | null;
    dockerHost?: string | null;
    sshHost?: string | null;
    sshPort?: number | null;
    sshUsername?: string | null;
    credentialId?: string | null;
    hostKeys?: string[] | null;
}
