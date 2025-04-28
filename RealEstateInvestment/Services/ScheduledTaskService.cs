using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using RealEstateInvestment.Models;
using RealEstateInvestment.Data;
using Microsoft.EntityFrameworkCore;

namespace RealEstateInvestment.Services
{
    public class ScheduledTaskService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly IHttpClientFactory _httpClientFactory;

        public ScheduledTaskService(IServiceProvider serviceProvider, IHttpClientFactory httpClientFactory)
        {
            _serviceProvider = serviceProvider;
            _httpClientFactory = httpClientFactory;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await RunScheduledTasks();
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Scheduled task error: {ex.Message}");
                }

                await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken); // 5 min
            }
        }

        private async Task RunScheduledTasks()
        {
            using (var scope = _serviceProvider.CreateScope())
            {
                var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var client = _httpClientFactory.CreateClient();

                var properties = await context.Properties.ToListAsync();

                foreach (var property in properties)
                {
                    try
                    {
                        // https://sell-estate.onrender.com/api
                        // http://10.0.2.2:7019/api
                        var response = await client.PostAsync($"https://sell-estate.onrender.com/api/properties/{property.Id}/validate-payments", null); // todo move to config

                        if (response.IsSuccessStatusCode)
                        {
                            context.ActionLogs.Add(new ActionLog
                            {
                                UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo admin guid
                                Action = "ScheduledPaymentValidationSuccess",
                                Details = $"Validated payments for property: {property.Title}"
                            });
                        }
                        else
                        {
                            context.ActionLogs.Add(new ActionLog
                            {
                                UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"),
                                Action = "ScheduledPaymentValidationError",
                                Details = $"Failed to validate property: {property.Title}, StatusCode: {response.StatusCode}"
                            });
                        }
                    }
                    catch (Exception ex)
                    {
                        context.ActionLogs.Add(new ActionLog
                        {
                            UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"),
                            Action = "ScheduledPaymentValidationException",
                            Details = $"Exception validating property: {property.Title}, Error: {ex.Message}"
                        });
                    }
                }

                await context.SaveChangesAsync();  // save all logs
            }
        }
    }
}

//using Microsoft.Extensions.Hosting;
//using Microsoft.Extensions.DependencyInjection;
//using RealEstateInvestment.Models;
//using RealEstateInvestment.Data;
//using Microsoft.EntityFrameworkCore;

//namespace RealEstateInvestment.Services
//{
//    public class ScheduledTaskService : BackgroundService
//    {
//        private readonly IServiceProvider _serviceProvider;
//        private readonly IHttpClientFactory _httpClientFactory;
//        private readonly List<ScheduledTask> _tasks = new();

//        public ScheduledTaskService(IServiceProvider serviceProvider, IHttpClientFactory httpClientFactory)
//        {
//            _serviceProvider = serviceProvider;
//            _httpClientFactory = httpClientFactory;

//            RegisterTasks();
//        }

//        private void RegisterTasks()
//        {
//            _tasks.Add(new ScheduledTask
//            {
//                Interval = TimeSpan.FromMinutes(5),
//                Action = async (provider) =>
//                {
//                    using var scope = provider.CreateScope();
//                    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
//                    var client = _httpClientFactory.CreateClient();

//                    var properties = await context.Properties.ToListAsync();
//                    foreach (var property in properties)
//                    {
//                        try
//                        {
//                            var response = await client.PostAsync(
//                                $"https://sell-estate.onrender.com/api/properties/{property.Id}/validate-payments", null); // todo move to config

//                            if (response.IsSuccessStatusCode)
//                            {
//                                context.ActionLogs.Add(new ActionLog
//                                {
//                                    UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"),
//                                    Action = "ScheduledPaymentValidationSuccess",
//                                    Details = $"Validated payments for property: {property.Title}"
//                                });
//                            }
//                            else
//                            {
//                                context.ActionLogs.Add(new ActionLog
//                                {
//                                    UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"),
//                                    Action = "ScheduledPaymentValidationError",
//                                    Details = $"Failed to validate property: {property.Title}, StatusCode: {response.StatusCode}"
//                                });
//                            }
//                        }
//                        catch (Exception ex)
//                        {
//                            context.ActionLogs.Add(new ActionLog
//                            {
//                                UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"),
//                                Action = "ScheduledPaymentValidationException",
//                                Details = $"Exception validating property: {property.Title}, Error: {ex.Message}"
//                            });
//                        }
//                    }

//                    await context.SaveChangesAsync();
//                }
//            });

//            // 👉 Здесь можно будет добавить другие задачи!
//            // _tasks.Add(new ScheduledTask { ... })
//        }

//        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
//        {
//            while (!stoppingToken.IsCancellationRequested)
//            {
//                foreach (var task in _tasks)
//                {
//                    if (DateTime.UtcNow - task.LastRunTime >= task.Interval)
//                    {
//                        try
//                        {
//                            using var scope = _serviceProvider.CreateScope();
//                            await task.Action(scope.ServiceProvider);
//                            task.LastRunTime = DateTime.UtcNow;
//                        }
//                        catch (Exception ex)
//                        {
//                            Console.WriteLine($"Scheduled task error: {ex.Message}");
//                            // Можно также сохранить в ActionLog ошибку выполнения самой задачи
//                        }
//                    }
//                }

//                await Task.Delay(1000, stoppingToken); // Проверяем задачи каждую секунду
//            }
//        }
//    }
//}
