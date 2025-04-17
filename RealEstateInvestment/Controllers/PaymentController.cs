using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateInvestment.Models;
using System;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Route("api/payments")]
    public class PaymentController : ControllerBase
    {
        [HttpPost("simulate-payment")]
        public IActionResult SimulatePayment([FromBody] decimal amount)
        {
            // todo
            //_context.ActionLogs.Add(new ActionLog
            //{
            //    UserId = new Guid("a7b4b538-03d3-446e-82ef-635cbd7bcc6e"), // todo add admin guid later
            //    Action = "SimulatePayment",
            //    Details = "SimulatePayment"  
            //});
            return Ok(new
            {
                message = "Payment was successful",
                transactionId = Guid.NewGuid()
            });
        }
    }
}
