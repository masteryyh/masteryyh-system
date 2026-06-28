package win.masteryyh.masteryyhsystem.base.utils;

import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Component;
import win.masteryyh.masteryyhsystem.base.exception.BusinessException;
import win.masteryyh.masteryyhsystem.model.GatewayEntryPoint;
import win.masteryyh.masteryyhsystem.model.GatewayRoute;
import win.masteryyh.masteryyhsystem.model.dto.GatewayRouteType;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class NginxConfigCodec {
    private static final Pattern LISTEN = Pattern.compile("\\blisten\\s+(\\d+)(?:\\s+ssl)?\\s*;");
    private static final Pattern SERVER_NAME = Pattern.compile("\\bserver_name\\s+([^;]+);");
    private static final Pattern LOCATION = Pattern.compile("location\\s+([^\\s{]+)\\s*\\{(.*?)\\}", Pattern.DOTALL);
    private static final Pattern PROXY_PASS = Pattern.compile("\\bproxy_pass\\s+([^;]+);");
    private static final Pattern ALIAS = Pattern.compile("\\balias\\s+([^;]+);");
    private static final Pattern ROOT = Pattern.compile("\\broot\\s+([^;]+);");
    private static final Pattern SSL_CERT = Pattern.compile("\\bssl_certificate\\s+([^;]+);");

    public String write(GatewayEntryPoint entryPoint, List<GatewayRoute> routes) {
        StringBuilder config = new StringBuilder();
        config.append("server {\n");
        config.append("    listen ").append(entryPoint.getListenPort());
        if (entryPoint.getCertificateCredentialId() != null) {
            config.append(" ssl");
        }
        config.append(";\n");
        config.append("    server_name ")
                .append(String.join(" ", entryPoint.getDomainNames()))
                .append(";\n");

        if (entryPoint.getCertificateCredentialId() != null) {
            String certRoot = "/etc/nginx/masteryyh/certs/" + entryPoint.getGatewayId()
                    + "/" + entryPoint.getId();
            config.append("\n");
            config.append("    ssl_certificate ").append(certRoot).append("/certificate.pem;\n");
            config.append("    ssl_certificate_key ").append(certRoot).append("/private-key.pem;\n");
            config.append("    ssl_protocols TLSv1.2 TLSv1.3;\n");
        }

        for (GatewayRoute route : routes) {
            config.append("\n");
            config.append("    location ").append(route.getPathPrefix()).append(" {\n");
            if (route.getRouteType() == GatewayRouteType.PROXY) {
                config.append("        proxy_pass ").append(route.getProxyTarget()).append(";\n");
                config.append("        proxy_set_header Host $host;\n");
                config.append("        proxy_set_header X-Real-IP $remote_addr;\n");
                config.append("        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n");
                config.append("        proxy_set_header X-Forwarded-Proto $scheme;\n");
            } else {
                String staticRoot = "/var/www/masteryyh/" + entryPoint.getGatewayId() + "/" + route.getId();
                if ("/".equals(route.getPathPrefix())) {
                    config.append("        root ").append(staticRoot).append(";\n");
                    config.append("        try_files $uri $uri/ /index.html;\n");
                } else {
                    config.append("        alias ").append(staticRoot).append("/;\n");
                    config.append("        index index.html;\n");
                }
            }
            config.append("    }\n");
        }
        config.append("}\n");
        return config.toString();
    }

    public List<ParsedEntryPoint> parse(String content) {
        if (StringUtils.isBlank(content)) {
            return List.of();
        }
        List<ParsedEntryPoint> parsed = new ArrayList<>();
        for (String body : blocks(content, "server")) {
            int port = requiredInt(LISTEN, body, "listen");
            String domains = required(SERVER_NAME, body, "server_name");
            boolean https = SSL_CERT.matcher(body).find();
            List<ParsedRoute> routes = new ArrayList<>();
            Matcher locationMatcher = LOCATION.matcher(body);
            while (locationMatcher.find()) {
                String path = locationMatcher.group(1);
                String locationBody = locationMatcher.group(2);
                Matcher proxy = PROXY_PASS.matcher(locationBody);
                Matcher alias = ALIAS.matcher(locationBody);
                Matcher root = ROOT.matcher(locationBody);
                if (proxy.find()) {
                    routes.add(new ParsedRoute(path, GatewayRouteType.PROXY, proxy.group(1).trim()));
                } else if (alias.find()) {
                    routes.add(new ParsedRoute(path, GatewayRouteType.STATIC, alias.group(1).trim()));
                } else if (root.find()) {
                    routes.add(new ParsedRoute(path, GatewayRouteType.STATIC, root.group(1).trim()));
                } else {
                    throw unsupported("location " + path + " has no supported proxy_pass or alias directive");
                }
            }
            parsed.add(new ParsedEntryPoint(port,
                    Arrays.stream(domains.trim().split("\\s+")).toList(), https, routes));
        }
        if (parsed.isEmpty()) {
            throw unsupported("No server block found");
        }
        return parsed;
    }

    public String filename(String gatewayName, String entryPointName) {
        requireSafeName(gatewayName, "gateway");
        requireSafeName(entryPointName, "entry point");
        return gatewayName + "-" + entryPointName + ".conf";
    }

    public void validateMainConfig(String content) {
        if (StringUtils.isBlank(content)) {
            return;
        }
        Pattern include = Pattern.compile("include\\s+/etc/nginx/conf\\.d/\\*\\.conf\\s*;");
        if (!include.matcher(content).find()) {
            throw new BusinessException(400, "error.gateway.mainConfig.includeMissing",
                    "Custom nginx.conf must include /etc/nginx/conf.d/*.conf");
        }
    }

    public void requireSafeName(String name, String label) {
        if (name == null || !name.matches("[A-Za-z0-9][A-Za-z0-9._-]{0,63}")) {
            throw new BusinessException(400, "error.gateway.name.invalid",
                    label + " name may only contain letters, digits, dots, underscores and hyphens");
        }
    }

    private static String required(Pattern pattern, String body, String directive) {
        Matcher matcher = pattern.matcher(body);
        if (!matcher.find()) {
            throw unsupported("Missing " + directive + " directive");
        }
        return matcher.group(1);
    }

    private static int requiredInt(Pattern pattern, String body, String directive) {
        return Integer.parseInt(required(pattern, body, directive));
    }

    private static BusinessException unsupported(String message) {
        return new BusinessException(400, "error.gateway.nginxConfig.unsupported", message);
    }

    private static List<String> blocks(String content, String keyword) {
        List<String> result = new ArrayList<>();
        Pattern startPattern = Pattern.compile("\\b" + Pattern.quote(keyword) + "\\s*\\{");
        Matcher matcher = startPattern.matcher(content);
        int searchFrom = 0;
        while (matcher.find(searchFrom)) {
            int open = content.indexOf('{', matcher.start());
            int depth = 1;
            int cursor = open + 1;
            while (cursor < content.length() && depth > 0) {
                char current = content.charAt(cursor);
                if (current == '{') depth++;
                if (current == '}') depth--;
                cursor++;
            }
            if (depth != 0) {
                throw unsupported("Unclosed " + keyword + " block");
            }
            result.add(content.substring(open + 1, cursor - 1));
            searchFrom = cursor;
        }
        return result;
    }

    public record ParsedEntryPoint(int listenPort, List<String> domainNames,
                                   boolean https, List<ParsedRoute> routes) {
    }

    public record ParsedRoute(String pathPrefix, GatewayRouteType routeType, String target) {
    }
}
