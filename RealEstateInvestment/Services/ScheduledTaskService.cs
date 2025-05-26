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
                   //todo отключили пока
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
               // var client = _httpClientFactory.CreateClient();

                var now = DateTime.UtcNow;
                var properties = await context.Properties
                    .Include(p => p.PaymentPlans)
                    .ToListAsync();

                //var properties = await context.Properties.ToListAsync();

                foreach (var property in properties)
                {
                    if (property.Status == "sold" || property.Status == "declined")
                        continue;
 
                    var step = property.PaymentPlans
                                        ?.Where(p => p.DueDate <= now && p.Paid == 0)  
                                        .OrderBy(p => p.DueDate)
                                        .FirstOrDefault();

                    if (step == null)
                        continue;

                    var minEventDate = property.PaymentPlans.Min(p => p.EventDate);

                    var applications = await context.InvestmentApplications
                        .Where(a => a.PropertyId == property.Id && step.EventDate == minEventDate  )
                        .OrderByDescending(a => a.IsPriority)
                        .ThenBy(a => a.CreatedAt)
                        .ToListAsync();

                    decimal totalAllocated = 0;
                    bool acceptedAny = false;

                    decimal totalRequested = applications.Sum(a => a.RequestedAmount);
                    if (totalRequested >= step.Total)
                    {
                        foreach (var app in applications)
                        {

                            // todo пока проверку убрали if (totalAllocated + app.RequestedAmount <= step.Total)
                            {
                                var user = await context.Users.FindAsync(app.UserId);
                                if (user == null) //  || user.WalletBalance < app.RequestedAmount уже зарезервировали
                                    continue;

                                //user.WalletBalance -= app.RequestedAmount; уже зарезервировали
                                property.AvailableShares -= app.RequestedShares;
                                totalAllocated += app.RequestedAmount;

                                context.Investments.Add(new Investment
                                {
                                    UserId = app.UserId,
                                    PropertyId = app.PropertyId,
                                    Shares = app.RequestedShares,
                                    InvestedAmount = app.RequestedAmount,
                                    CreatedAt = now
                                });

                                // todo логика на будущее app.Status = app.RequestedAmount == step.Total ? "accepted" : "partial";
                                app.Status = "accepted";
                                app.ApprovedShares = app.RequestedShares;
                                app.ApprovedAmount = app.RequestedAmount;

                                context.Messages.Add(new Message
                                {
                                    Title = "Your investment application was approved",
                                    Content = $"You were allocated {app.RequestedShares} shares for property {property.Title}.",
                                    RecipientId = app.UserId
                                });

                                acceptedAny = true;

                              


                                //if (app.RequestedAmount >= step.Total)   уже зарезервировали
                                //    property.PriorityInvestorId = app.UserId;
                            }
                            // логика которую пока убрали
                            //else
                            //{
                            //    app.Status = "carried";
                            //    app.StepNumber += 1;

                            //    context.Messages.Add(new Message
                            //    {
                            //        Title = "Your application has been carried over",
                            //        Content = $"Your application for property {property.Title} has been moved to the next stage.",
                            //        RecipientId = app.UserId
                            //    });
                            //}
                        }
                        step.Paid = totalAllocated;
                    }

                    if (!acceptedAny)
                    {
                        foreach (var app in applications)
                        {
                            var user = await context.Users.FindAsync(app.UserId);
                            if (user != null)
                            {
                                user.WalletBalance += app.RequestedAmount;

                                app.Status = "rejected";
                                property.PriorityInvestorId = null; // todo сбрасывает в рамках логики тестов
                                context.Messages.Add(new Message
                                {
                                    Title = "Application rejected",
                                    Content = $"Your application for property {property.Title} was rejected due to insufficient funding.",
                                    RecipientId = app.UserId
                                });
                            }
                            
                        }
                    }

                    context.ActionLogs.Add(new ActionLog
                    {
                        UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"),
                        Action = acceptedAny ? "InvestmentStepAccepted" : "InvestmentStepRejected",
                        Details = $"PropertyId: {property.Id}, Step DueDate: {step.DueDate}, Accepted: {acceptedAny}"
                    });

                    //try
                    //{
                    //    // https://sell-estate.onrender.com/api
                    //    // http://10.0.2.2:7019/api
                    //    var response = await client.PostAsync($"https://sell-estate.onrender.com/api/properties/{property.Id}/validate-payments", null); // todo move to config

                    //    if (response.IsSuccessStatusCode)
                    //    {
                    //        context.ActionLogs.Add(new ActionLog
                    //        {
                    //            UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo admin guid
                    //            Action = "ScheduledPaymentValidationSuccess",
                    //            Details = $"Validated payments for property: {property.Title}"
                    //        });
                    //    }
                    //    else
                    //    {
                    //        context.ActionLogs.Add(new ActionLog
                    //        {
                    //            UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"),
                    //            Action = "ScheduledPaymentValidationError",
                    //            Details = $"Failed to validate property: {property.Title}, StatusCode: {response.StatusCode}"
                    //        });
                    //    }
                    //}
                    //catch (Exception ex)
                    //{
                    //    context.ActionLogs.Add(new ActionLog
                    //    {
                    //        UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"),
                    //        Action = "ScheduledPaymentValidationException",
                    //        Details = $"Exception validating property: {property.Title}, Error: {ex.Message}"
                    //    });
                    //}
                }

                 await context.SaveChangesAsync(); 
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
