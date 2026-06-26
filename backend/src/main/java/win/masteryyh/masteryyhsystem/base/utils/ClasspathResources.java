package win.masteryyh.masteryyhsystem.base.utils;

import java.io.IOException;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

@Component
public class ClasspathResources {
    @Value("classpath:gateway_setup.sh")
    private Resource gatewayScript;

    public byte[] getGatewayScript() throws IOException {
        return gatewayScript.getContentAsByteArray();
    }
}
