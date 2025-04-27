using Microsoft.AspNetCore.Mvc;
using RealEstateInvestment.Services;

namespace RealEstateInvestment.Controllers
{
    [ApiController]
    [Route("api/captcha")]
    public class CaptchaController : ControllerBase
    {
        private readonly CaptchaService _service;

        public CaptchaController(CaptchaService service)
        {
            _service = service;
        }

        [HttpGet("generate")]
        public IActionResult Generate()
        {
            var (id, expr) = _service.Generate();
            return Ok(new { id, expression = expr });
        }

        public class VerifyRequest
        {
            public Guid Id { get; set; }
            public int Answer { get; set; }
        }

        [HttpPost("verify")]
        public IActionResult Verify([FromBody] VerifyRequest request)
        {
            var isValid = _service.Verify(request.Id, request.Answer);
            return Ok(new { success = isValid });
        }
    }

}
