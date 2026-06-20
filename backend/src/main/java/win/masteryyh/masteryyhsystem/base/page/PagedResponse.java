package win.masteryyh.masteryyhsystem.base.page;

import java.util.List;

public record PagedResponse<T>(List<T> data,
                               int page,
                               int pageSize,
                               int totalPages,
                               long totalData) {
}
