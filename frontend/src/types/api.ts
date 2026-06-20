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
    | "TEXT_PASSWORD";

export type SSHKeyType = "RSA" | "DSA" | "ECDSA" | "ED25519";

export interface SSHKeyInfo {
    keyType: SSHKeyType;
    bitLength: number;
    curveName: string | null;
    fingerprint: string;
}

export interface Credential {
    id: string;
    name: string;
    description: string | null;
    credentialType: CredentialType;
    sshPublicKey: string | null;
    sshKeyInfo: SSHKeyInfo | null;
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
}

export interface UpdateCredentialRequest {
    name: string;
    description: string;
}

export type PlatformType = "SYSTEMD" | "DOCKER";

export interface AppPlatform {
    id: string;
    name: string;
    description: string | null;
    platformType: PlatformType;
    dockerHost: string | null;
    systemdSSHHost: string | null;
    systemdSSHPort: number | null;
    systemdSSHUsername: string | null;
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
    dockerHost?: string | null;
    systemdSSHHost?: string | null;
    systemdSSHPort?: number | null;
    systemdSSHUsername?: string | null;
    credentialId?: string | null;
    hostKeys?: string[] | null;
}
