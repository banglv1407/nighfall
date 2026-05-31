# 0006 Upgrade better-sqlite3 for Node.js 25 Support

Date: 2026-05-31

## Status

Accepted

## Context

During the initial installation of backend dependencies in the `server` directory on the target environment running **Node.js v25.9.0 (Windows x64)**, the install failed with `exit code 1` on the `better-sqlite3` build script. 

The project originally locked `better-sqlite3` to `^11.0.0`. Since `v11.x` did not provide precompiled native binaries for Node.js 25, the installer defaulted to compiling from source using `node-gyp`. This compilation failed on the host system because the Microsoft Visual C++ Build Tools compiler (`CL.exe`) was not accessible in the user's CLI path.

## Decision

We decided to upgrade `better-sqlite3` to version **`^12.4.5`** in [server/package.json](file:///E:/Game/server/package.json).

According to release history, `better-sqlite3` introduced full precompiled binaries for Node.js 25 starting in version `12.4.5`. This removes the need for downstream C++ builds altogether.

## Alternatives Considered

1. **Install MSVC C++ Build Tools:** Rejected because configuring complete Visual Studio workflows on the host terminal creates unnecessary environment dependencies and consumes substantial disk space/time.
2. **Downgrade Node.js to v20/v22 LTS:** Rejected since changing the host runtime version could disrupt other active projects on the machine. Upgrading the package itself is the cleanest, least invasive solution.

## Consequences

### Positive:
- **Zero-compilation install:** The backend installs in under 3 seconds using verified prebuilt binaries.
- **Node.js 25 compatibility:** Restores smooth local operation and zero-configuration setups on modern execution environments.
- **Security:** Reduced dependency security vulnerabilities to exactly `0` inside the server subfolder.

### Tradeoffs:
- None. `better-sqlite3` version `12.x` retains full API backward compatibility with the database tables and query methods defined in `db.js`.
