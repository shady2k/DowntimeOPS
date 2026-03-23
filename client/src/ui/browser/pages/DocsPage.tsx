import { useBrowserStore } from "../browserStore";
import { THEME } from "../../theme";

interface DocsPageProps {
  article?: string;
}

export function DocsPage({ article }: DocsPageProps) {
  const navigate = useBrowserStore((s) => s.navigate);

  if (article === "quickstart") return <QuickStartArticle />;
  if (article === "subnets") return <SubnetsArticle />;
  if (article === "vlans") return <VlanGuideArticle />;
  if (article === "ipam") return <IpamGuideArticle />;
  if (article === "server-setup") return <ServerSetupArticle />;

  // Index page
  return (
    <div style={{ padding: 20, fontFamily: THEME.fonts.body, fontSize: 11, color: THEME.colors.text }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: THEME.colors.accent, marginBottom: 16, fontFamily: THEME.fonts.heading }}>
        Documentation
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <DocLink
          title="Quick Start Guide"
          description="Set up your first router, assign IPs, and get traffic flowing."
          onClick={() => navigate({ type: "docs", article: "quickstart" })}
        />
        <DocLink
          title="Subnet Reference"
          description="IP addressing, CIDR notation, common subnet sizes."
          onClick={() => navigate({ type: "docs", article: "subnets" })}
        />
        <DocLink
          title="VLAN Guide"
          description="Virtual LANs, trunk vs access ports, assigning ports to VLANs."
          onClick={() => navigate({ type: "docs", article: "vlans" })}
        />
        <DocLink
          title="IPAM Guide"
          description="Plan your IP space with the IP Address Manager tool."
          onClick={() => navigate({ type: "docs", article: "ipam" })}
        />
        <DocLink
          title="Server Setup"
          description="Configure server networking, gateways, and services."
          onClick={() => navigate({ type: "docs", article: "server-setup" })}
        />
      </div>
    </div>
  );
}

function DocLink({ title, description, onClick }: { title: string; description: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "block",
        textAlign: "left",
        background: THEME.colors.bgCard,
        border: `1px solid ${THEME.colors.border}`,
        borderRadius: THEME.radius.md,
        padding: "10px 14px",
        cursor: "pointer",
        width: "100%",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = THEME.colors.accent; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = THEME.colors.border; }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: THEME.colors.info, fontFamily: THEME.fonts.body, marginBottom: 2 }}>
        {title}
      </div>
      <div style={{ fontSize: 10, color: THEME.colors.textMuted, fontFamily: THEME.fonts.body }}>
        {description}
      </div>
    </button>
  );
}

function QuickStartArticle() {
  return (
    <div style={{ padding: 20, fontFamily: THEME.fonts.body, fontSize: 11, color: THEME.colors.text, lineHeight: 1.6 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: THEME.colors.accent, marginBottom: 12, fontFamily: THEME.fonts.heading }}>
        Quick Start Guide
      </h2>

      <Section title="1. Install a Router">
        Your router connects your datacenter to the internet. Place it in a rack, then click its{" "}
        <strong style={{ color: THEME.colors.warning }}>console port</strong> to open the management interface.
      </Section>

      <Section title="2. Configure Interfaces">
        Each port on the router is an <em>interface</em>. Assign an IP address and subnet mask to each interface you want to use.
        <br /><br />
        Your first router port comes pre-configured with <Code>10.0.0.1/24</Code>. This means:
        <ul style={{ margin: "4px 0 4px 16px", padding: 0 }}>
          <li>IP address: <Code>10.0.0.1</Code></li>
          <li>Subnet: <Code>10.0.0.0/24</Code> (addresses 10.0.0.1 — 10.0.0.254)</li>
        </ul>
      </Section>

      <Section title="3. Cable Your Devices">
        Connect switches and servers to the router with network cables. Each device needs an IP in the same subnet to communicate.
      </Section>

      <Section title="4. Add Routes">
        For traffic to flow between different subnets, add <em>static routes</em> on the router.
        A <strong>default route</strong> (<Code>0.0.0.0/0</Code>) sends all unmatched traffic to the ISP uplink.
      </Section>

      <Section title="5. Accept Clients">
        Once your network is configured, accept client contracts. Traffic will flow through your infrastructure based on your routing configuration.
      </Section>
    </div>
  );
}

function SubnetsArticle() {
  return (
    <div style={{ padding: 20, fontFamily: THEME.fonts.body, fontSize: 11, color: THEME.colors.text, lineHeight: 1.6 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: THEME.colors.accent, marginBottom: 12, fontFamily: THEME.fonts.heading }}>
        Subnet Reference
      </h2>

      <Section title="CIDR Notation">
        IP addresses are written as <Code>10.0.1.0/24</Code> where <Code>/24</Code> is the subnet mask (how many bits are the network portion).
      </Section>

      <Section title="Common Subnet Sizes">
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 10, fontFamily: THEME.fonts.mono }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${THEME.colors.border}` }}>
              <Th>CIDR</Th><Th>Mask</Th><Th>Hosts</Th><Th>Use Case</Th>
            </tr>
          </thead>
          <tbody>
            <Tr><Td>/30</Td><Td>255.255.255.252</Td><Td>2</Td><Td>Point-to-point link</Td></Tr>
            <Tr><Td>/28</Td><Td>255.255.255.240</Td><Td>14</Td><Td>Small server group</Td></Tr>
            <Tr><Td>/24</Td><Td>255.255.255.0</Td><Td>254</Td><Td>Standard subnet</Td></Tr>
            <Tr><Td>/16</Td><Td>255.255.0.0</Td><Td>65,534</Td><Td>Large network</Td></Tr>
          </tbody>
        </table>
      </Section>

      <Section title="Private IP Ranges">
        <div style={{ fontFamily: THEME.fonts.mono, fontSize: 10 }}>
          <Code>10.0.0.0/8</Code> — 10.0.0.0 to 10.255.255.255<br />
          <Code>172.16.0.0/12</Code> — 172.16.0.0 to 172.31.255.255<br />
          <Code>192.168.0.0/16</Code> — 192.168.0.0 to 192.168.255.255<br />
        </div>
      </Section>
    </div>
  );
}

function VlanGuideArticle() {
  return (
    <div style={{ padding: 20, fontFamily: THEME.fonts.body, fontSize: 11, color: THEME.colors.text, lineHeight: 1.6 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: THEME.colors.accent, marginBottom: 12, fontFamily: THEME.fonts.heading }}>
        VLAN Guide
      </h2>

      <Section title="What Are VLANs?">
        A <strong>VLAN</strong> (Virtual LAN) divides a physical switch into separate logical networks.
        Devices on different VLANs cannot communicate directly — they need a router to bridge traffic between them.
        <br /><br />
        This is how you isolate client traffic, keep management networks private, and organize your datacenter.
      </Section>

      <Section title="Creating VLANs">
        Open a switch&apos;s console port and go to the <strong>VLANs</strong> tab.
        Enter a VLAN ID (2–4094) and a name, then click Add.
        <br /><br />
        <Code>VLAN 1</Code> is the default VLAN — all ports start here. It cannot be deleted.
      </Section>

      <Section title="Access vs Trunk Ports">
        <ul style={{ margin: "4px 0 4px 16px", padding: 0 }}>
          <li><strong>Access port</strong> — belongs to one VLAN. Use for end devices (servers, workstations).</li>
          <li><strong>Trunk port</strong> — carries traffic for multiple VLANs. Use between switches or between a switch and a router.</li>
        </ul>
      </Section>

      <Section title="Assigning Ports">
        In the switch&apos;s <strong>Ports</strong> tab, select a port and change its mode to Access or Trunk.
        For access ports, pick the VLAN. For trunk ports, select which VLANs are allowed.
      </Section>
    </div>
  );
}

function IpamGuideArticle() {
  return (
    <div style={{ padding: 20, fontFamily: THEME.fonts.body, fontSize: 11, color: THEME.colors.text, lineHeight: 1.6 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: THEME.colors.accent, marginBottom: 12, fontFamily: THEME.fonts.heading }}>
        IPAM Guide
      </h2>

      <Section title="What Is IPAM?">
        The <strong>IP Address Manager</strong> is a planning tool. Use it to design your IP address scheme
        before configuring devices. It tracks which IPs are allocated and to which devices.
        <br /><br />
        IPAM does <em>not</em> auto-configure devices — you still set IPs manually on each device&apos;s management page.
      </Section>

      <Section title="Creating Subnets">
        Click the <strong>IPAM</strong> bookmark to open the tool. Enter a network address, prefix length, and name.
        <br /><br />
        Example: <Code>10.0.1.0/24</Code> named &quot;Servers&quot; gives you 254 usable host addresses.
        <br /><br />
        You can optionally link a subnet to a VLAN for organization.
      </Section>

      <Section title="Allocating IPs">
        Click a subnet to see its detail view. Use the Allocate form to reserve IPs.
        You can link an allocation to a specific device and add a description.
        <br /><br />
        The usage bar shows how much of the subnet is allocated.
      </Section>

      <Section title="Recommended Workflow">
        <ol style={{ margin: "4px 0 4px 16px", padding: 0 }}>
          <li>Plan subnets in IPAM (e.g., 10.0.1.0/24 for servers, 10.0.2.0/24 for management)</li>
          <li>Allocate IPs to devices in IPAM</li>
          <li>Configure each device&apos;s interface with the planned IP</li>
          <li>Add routes on your router for each subnet</li>
        </ol>
      </Section>
    </div>
  );
}

function ServerSetupArticle() {
  return (
    <div style={{ padding: 20, fontFamily: THEME.fonts.body, fontSize: 11, color: THEME.colors.text, lineHeight: 1.6 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: THEME.colors.accent, marginBottom: 12, fontFamily: THEME.fonts.heading }}>
        Server Setup
      </h2>

      <Section title="Network Configuration">
        Open a server&apos;s console port to access its management page. In the <strong>Network</strong> tab, set:
        <ul style={{ margin: "4px 0 4px 16px", padding: 0 }}>
          <li><strong>IP Address</strong> — the server&apos;s address on the network (e.g., <Code>10.0.1.10</Code>)</li>
          <li><strong>Subnet Mask</strong> — must match the subnet (e.g., <Code>/24</Code>)</li>
          <li><strong>Gateway</strong> — the router IP for this subnet (e.g., <Code>10.0.1.1</Code>)</li>
        </ul>
      </Section>

      <Section title="Connecting to a Switch">
        Cable the server to a switch port. Make sure the switch port is on the correct VLAN (if using VLANs)
        and the server&apos;s IP is in the same subnet as the router interface for that VLAN.
      </Section>

      <Section title="Services">
        In the <strong>Services</strong> tab, toggle services on or off. Services define what traffic
        the server handles (HTTP, database, application). Clients require specific services to be running.
      </Section>

      <Section title="Checklist">
        <ol style={{ margin: "4px 0 4px 16px", padding: 0 }}>
          <li>Cable server to switch</li>
          <li>Set IP, mask, and gateway on server</li>
          <li>Ensure switch port is on the right VLAN</li>
          <li>Ensure router has an interface on the same subnet</li>
          <li>Enable required services</li>
        </ol>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 12, fontWeight: 700, color: THEME.colors.text, marginBottom: 4 }}>{title}</h3>
      <div style={{ color: THEME.colors.textMuted }}>{children}</div>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        background: THEME.colors.bgInput,
        padding: "1px 4px",
        borderRadius: 2,
        fontFamily: THEME.fonts.mono,
        fontSize: 10,
        color: THEME.colors.info,
      }}
    >
      {children}
    </code>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ textAlign: "left", padding: "4px 8px", color: THEME.colors.textDim }}>{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: "3px 8px", color: THEME.colors.textMuted }}>{children}</td>;
}

function Tr({ children }: { children: React.ReactNode }) {
  return <tr style={{ borderBottom: `1px solid ${THEME.colors.borderDark}` }}>{children}</tr>;
}
